module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const query = ((req.body && req.body.query) || '').toString().trim();
  const mode  = ((req.body && req.body.mode)  || 'artist').toString();

  if (!query) return res.status(400).json({ error: 'กรุณาพิมพ์ชื่อศิลปินหรือเพลง' });

  // 1. ทำความสะอาด API Key ลบเว้นวรรคและการขึ้นบรรทัดใหม่
  let apiKey = process.env.GEMINI_API_KEY || '';
  apiKey = apiKey.replace(/[\s"']/g, ''); 
  
  if (!apiKey) return res.status(500).json({ error: 'API Key ว่างเปล่า กรุณาเช็คใน Vercel' });

  var prompt = mode === 'song' ? buildSongPrompt(query) : buildArtistPrompt(query);

  try {
    // 2. กลับไปใช้ gemini-2.0-flash (ตัวเดิมของคุณที่ถูกต้องอยู่แล้ว)
    const apiUrl = new URL('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent');
    apiUrl.searchParams.append('key', apiKey);

    var geminiRes = await fetch(apiUrl.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.8 }
      })
    });

    if (!geminiRes.ok) {
      var errData = await geminiRes.json().catch(function(){ return {}; });
      return res.status(400).json({ error: 'Google API Error: ' + JSON.stringify(errData) });
    }

    var data = await geminiRes.json();
    var text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // 3. ทำความสะอาด JSON ให้ปลอดภัยจากการแตกบรรทัด
    text = text.split('```json').join('').split('```').join('').trim();

    var start = text.indexOf('{');
    var end   = text.lastIndexOf('}');
    if (start === -1 || end === -1) {
      return res.status(500).json({ error: 'AI ตอบกลับมาผิดรูปแบบ ไม่ใช่ JSON' });
    }
    text = text.slice(start, end + 1);

    var parsed = JSON.parse(text);
    return res.status(200).json(parsed);

  } catch (err) {
    return res.status(500).json({ error: 'รันโค้ดไม่สำเร็จ: ' + err.message });
  }
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
}module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const query = ((req.body && req.body.query) || '').toString().trim();
  const mode  = ((req.body && req.body.mode)  || 'artist').toString();

  if (!query) return res.status(400).json({ error: 'กรุณาพิมพ์ชื่อศิลปินหรือเพลง' });

  // 1. ทำความสะอาด API Key ขั้นเด็ดขาด (ลบเว้นวรรค, ขึ้นบรรทัดใหม่, และเครื่องหมายคำพูด " ' ที่อาจเผลอก๊อปติดมา)
  let apiKey = process.env.GEMINI_API_KEY || '';
  apiKey = apiKey.replace(/[\s"']/g, ''); 
  
  if (!apiKey) return res.status(500).json({ error: 'API Key ว่างเปล่า กรุณาเช็คใน Vercel' });

  var prompt = mode === 'song' ? buildSongPrompt(query) : buildArtistPrompt(query);

  try {
    // 2. ใช้ URL Object แทนการใช้เครื่องหมาย + เพื่อป้องกัน Error: Failed to parse URL
    const apiUrl = new URL('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent');
    apiUrl.searchParams.append('key', apiKey);

    var geminiRes = await fetch(apiUrl.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.8 }
      })
    });

    if (!geminiRes.ok) {
      var errData = await geminiRes.json().catch(function(){ return {}; });
      return res.status(400).json({ error: 'Google API Error: ' + JSON.stringify(errData) });
    }

    var data = await geminiRes.json();
    var text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // 3. ทำความสะอาด JSON ให้ปลอดภัยจากการขึ้นบรรทัดใหม่
    text = text.split('```json').join('').split('```').join('').trim();

    var start = text.indexOf('{');
    var end   = text.lastIndexOf('}');
    if (start === -1 || end === -1) {
      return res.status(500).json({ error: 'AI ตอบกลับมาผิดรูปแบบ ไม่ใช่ JSON' });
    }
    text = text.slice(start, end + 1);

    var parsed = JSON.parse(text);
    return res.status(200).json(parsed);

  } catch (err) {
    // ดัก Error ทุกชนิดไม่ให้ Server พังเป็น 500 (FUNCTION_INVOCATION_FAILED)
    return res.status(500).json({ error: 'รันโค้ดไม่สำเร็จ: ' + err.message });
  }
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
