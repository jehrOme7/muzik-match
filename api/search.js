module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const query = ((req.body && req.body.query) || '').toString().trim();
  const mode  = ((req.body && req.body.mode)  || 'artist').toString();

  if (!query) return res.status(400).json({ error: 'กรุณาพิมพ์ชื่อศิลปินหรือเพลง' });
  if (query.length > 100) return res.status(400).json({ error: 'ข้อความยาวเกินไป' });

  var apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ระบบยังไม่ได้ตั้งค่า API key' });

  var prompt = mode === 'song' ? buildSongPrompt(query) : buildArtistPrompt(query);

  // free models ที่ใช้ได้บน OpenRouter (ไล่ตามคุณภาพ)
  var freeModels = [
    'meta-llama/llama-3.3-70b-instruct:free',
    'meta-llama/llama-3.1-8b-instruct:free',
    'mistralai/mistral-7b-instruct:free',
    'google/gemma-3-27b-it:free',
    'google/gemma-3-12b-it:free'
  ];

  var response, errData;
  for (var mi = 0; mi < freeModels.length; mi++) {
    try {
      response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + apiKey,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://muzik-match.vercel.app',
          'X-Title': 'Muzik Match'
        },
        body: JSON.stringify({
          model: freeModels[mi],
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.8,
          max_tokens: 2000
        })
      });

      if (response.status === 429 || response.status === 402) {
        console.log('Model', freeModels[mi], 'rate limited, trying next...');
        continue; // ลอง model ถัดไป
      }

      if (!response.ok) {
        errData = await response.json().catch(function(){ return {}; });
        console.error('OpenRouter error:', response.status, JSON.stringify(errData));
        continue;
      }
      break; // สำเร็จ หยุดลอง
    } catch (fetchErr) {
      console.error('Fetch error:', fetchErr.message);
      continue;
    }
  }

  if (!response || !response.ok) {
    return res.status(429).json({ error: 'ระบบมีผู้ใช้งานสูงในขณะนี้ กรุณาลองใหม่อีกครั้งในสักครู่' });
  }

  try {

    var data = await response.json();
    var text = ((data.choices &&
                 data.choices[0] &&
                 data.choices[0].message &&
                 data.choices[0].message.content) || '');

    // clean markdown code blocks
    text = text.replace(/```json/gi, '').replace(/```/g, '').trim();

    // หา JSON object
    var start = text.indexOf('{');
    var end   = text.lastIndexOf('}');
    if (start === -1 || end === -1) {
      console.error('No JSON found:', text.slice(0, 300));
      return res.status(500).json({ error: 'ได้รับข้อมูลไม่ถูกต้องจาก AI กรุณาลองใหม่' });
    }
    text = text.slice(start, end + 1);

    var parsed = JSON.parse(text);
    return res.status(200).json(parsed);

  } catch (err) {
    console.error('Parse error:', err.message);
    return res.status(500).json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่' });
  }
};

function buildSongPrompt(query) {
  return 'You are a music expert. The user likes this song: "' + query + '"\n\n' +
    'Analyze the genre, mood, era, rhythm, and style. If it is a Thai artist, prioritize recommending Thai songs first.\n\n' +
    'Respond ONLY with a valid JSON object. No markdown. No code blocks. Start directly with {\n\n' +
    '{"identified":"Song - Artist (nationality)","songs":[{"name":"song name","artist":"artist name","why":"brief reason in Thai (1 sentence)","tags":["tag1","tag2"]}]}\n\n' +
    'Provide exactly 6 songs. Write "why" and "tags" in Thai.';
}

function buildArtistPrompt(query) {
  return 'You are a music expert. Find artists similar to: "' + query + '"\n\n' +
    'Important: Some artists use English names but are Thai (e.g. blvckheart, NONT TANONT, URBOYTJ, YOUNGOHM). Check carefully using their work, label, and collaborations.\n' +
    'If the artist is Thai, prioritize recommending Thai artists first.\n\n' +
    'Respond ONLY with a valid JSON object. No markdown. No code blocks. Start directly with {\n\n' +
    '{"identified":"Artist (nationality)","bio":"2-3 sentence bio in Thai","nationality":"nationality in Thai","artists":[{"name":"artist name","genre":"genre","why":"brief reason in Thai (1 sentence)","tags":["tag1","tag2"],"wiki":"Wikipedia_title_or_empty_string","country":"ISO2 code e.g. TH US KR JP GB"}]}\n\n' +
    'Provide exactly 5 artists. Write "bio", "why", "nationality" and "tags" in Thai.';
}
