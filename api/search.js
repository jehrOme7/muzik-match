module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const query = ((req.body && req.body.query) || '').toString().trim();
  const mode  = ((req.body && req.body.mode)  || 'artist').toString();

  if (!query) return res.status(400).json({ error: 'กรุณาพิมพ์ชื่อศิลปินหรือเพลง' });
  if (query.length > 100) return res.status(400).json({ error: 'ข้อความยาวเกินไป' });

  const keys = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
  ].filter(Boolean);

  if (!keys.length) return res.status(500).json({ error: 'ระบบยังไม่ได้ตั้งค่า API key' });

  const prompt = mode === 'song' ? buildSongPrompt(query) : buildArtistPrompt(query);

  for (var ki = 0; ki < keys.length; ki++) {
    var key = keys[ki];
    for (var attempt = 0; attempt < 1; attempt++) {
      try {
        var geminiRes = await fetch(
          'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + key,
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
          console.log('429 key', ki, 'attempt', attempt);
          continue;
        }

        if (!geminiRes.ok) {
          var errData = await geminiRes.json().catch(function(){ return {}; });
          return res.status(500).json({
            error: 'AI error: ' + ((errData.error && errData.error.message) || geminiRes.status)
          });
        }

        var data = await geminiRes.json();
        var text = ((data.candidates &&
                     data.candidates[0] &&
                     data.candidates[0].content &&
                     data.candidates[0].content.parts &&
                     data.candidates[0].content.parts[0] &&
                     data.candidates[0].content.parts[0].text) || '');

        // clean markdown
        text = text.replace(/```json/gi, '').replace(/```/g, '').trim();

        // หา JSON object
        var start = text.indexOf('{');
        var end   = text.lastIndexOf('}');
        if (start === -1 || end === -1) {
          console.log('No JSON found, text:', text.slice(0, 200));
          continue;
        }
        text = text.slice(start, end + 1);

        try {
          var parsed = JSON.parse(text);
          return res.status(200).json(parsed);
        } catch (parseErr) {
          console.log('Parse error:', parseErr.message, 'text:', text.slice(0, 300));
          continue;
        }

      } catch (fetchErr) {
        console.log('Fetch error:', fetchErr.message);
      }
    }
  }

  return res.status(429).json({
    error: 'ระบบมีผู้ใช้งานสูงในขณะนี้ กรุณาลองใหม่อีกครั้งในสักครู่'
  });
};

function sleep(ms) { return new Promise(function(r){ setTimeout(r, ms); }); }

function buildSongPrompt(query) {
  return 'You are a music expert. The user likes this song: "' + query + '"\n\n' +
    'Analyze the genre, mood, era, rhythm, and style. If it is a Thai artist, prioritize recommending Thai songs first.\n\n' +
    'Respond ONLY with a valid JSON object. No markdown. No code blocks. Start directly with {\n\n' +
    '{"identified":"Song - Artist (nationality)","songs":[{"name":"song","artist":"artist","why":"reason in Thai","tags":["tag1","tag2"]}]}\n\n' +
    'Provide exactly 6 songs.';
}

function buildArtistPrompt(query) {
  return 'You are a music expert. Find artists similar to: "' + query + '"\n\n' +
    'Note: Some artists use English names but are Thai (e.g. blvckheart, NONT TANONT, URBOYTJ, YOUNGOHM). Check carefully.\n' +
    'If the artist is Thai, prioritize recommending Thai artists first.\n\n' +
    'Respond ONLY with a valid JSON object. No markdown. No code blocks. Start directly with {\n\n' +
    '{"identified":"Artist (nationality)","bio":"bio in Thai","nationality":"nationality in Thai","artists":[{"name":"artist","genre":"genre","why":"reason in Thai","tags":["tag1","tag2"],"wiki":"Wikipedia_title_or_empty","country":"ISO2 e.g. TH US KR"}]}\n\n' +
    'Provide exactly 5 artists.';
}
