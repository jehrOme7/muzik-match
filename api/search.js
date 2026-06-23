module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const query = ((req.body && req.body.query) || '').toString().trim();
  const mode  = ((req.body && req.body.mode)  || 'artist').toString();

  if (!query) return res.status(400).json({ error: 'กรุณาพิมพ์ชื่อศิลปินหรือเพลง' });
  if (query.length > 100) return res.status(400).json({ error: 'ข้อความยาวเกินไป' });

  var keys = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
  ].filter(Boolean);

  if (!keys.length) return res.status(500).json({ error: 'ระบบยังไม่ได้ตั้งค่า API key' });

  var prompt = mode === 'song' ? buildSongPrompt(query) : buildArtistPrompt(query);

  for (var ki = 0; ki < keys.length; ki++) {
    try {
      var geminiRes = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + keys[ki],
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.8 }
          })
        }
      );

      if (geminiRes.status === 429) {
        console.log('429 on key', ki, '— trying next');
        continue;
      }

      if (!geminiRes.ok) {
        var errData = await geminiRes.json().catch(function(){ return {}; });
        return res.status(500).json({ error: 'AI error: ' + ((errData.error && errData.error.message) || geminiRes.status) });
      }

      var data = await geminiRes.json();
      var text = (
        data.candidates &&
        data.candidates[0] &&
        data.candidates[0].content &&
        data.candidates[0].content.parts &&
        data.candidates[0].content.parts[0] &&
        data.candidates[0].content.parts[0].text
      ) || '';

      // clean markdown
      text = text.replace(/```json/gi, '').replace(/```/g, '').trim();

      // extract JSON
      var start = text.indexOf('{');
      var end   = text.lastIndexOf('}');
      if (start === -1 || end === -1) {
        console.log('No JSON, retrying next key. text:', text.slice(0,100));
        continue;
      }
      text = text.slice(start, end + 1);

      try {
        var parsed = JSON.parse(text);
        return res.status(200).json(parsed);
      } catch (parseErr) {
        console.log('Parse error:', parseErr.message);
        continue;
      }

    } catch (fetchErr) {
      console.log('Fetch error:', fetchErr.message);
      continue;
    }
  }

  return res.status(429).json({ error: 'ระบบมีผู้ใช้งานสูงในขณะนี้ กรุณาลองใหม่อีกครั้งในสักครู่' });
};

function buildSongPrompt(query) {
  return 'You are a music expert. The user likes this song: "' + query + '"\n\n' +
    'Identify the song, artist, and nationality. If Thai artist, recommend Thai songs first.\n\n' +
    'Respond ONLY with valid JSON starting with { — no markdown, no explanation:\n\n' +
    '{"identified":"Song - Artist (nationality)","songs":[{"name":"song","artist":"artist","why":"reason in Thai","tags":["tag1","tag2"]}]}\n\n' +
    'Provide 6 songs. Write "why" and "tags" in Thai.';
}

function buildArtistPrompt(query) {
  return 'You are a music expert. Find artists similar to: "' + query + '"\n\n' +
    'IMPORTANT: Some artists use English names but are Thai (e.g. blvckheart, NONT TANONT, URBOYTJ, YOUNGOHM, SPRITE). Verify nationality from their work, label, and collaborations.\n' +
    'If Thai artist, recommend Thai artists first.\n\n' +
    'Respond ONLY with valid JSON starting with { — no markdown, no explanation:\n\n' +
    '{"identified":"Artist (nationality)","bio":"2-3 sentences in Thai","nationality":"nationality in Thai","artists":[{"name":"artist","genre":"genre","why":"reason in Thai","tags":["tag1","tag2"],"wiki":"Wikipedia_title_or_empty","country":"ISO2 e.g. TH US KR"}]}\n\n' +
    'Provide 5 artists. Write "bio", "why", "nationality", "tags" in Thai.';
}
