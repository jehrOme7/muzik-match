module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const query = ((req.body && req.body.query) || '').toString().trim();
  const mode = ((req.body && req.body.mode) || 'artist').toString();

  if (!query) {
    return res.status(400).json({ error: 'กรุณาพิมพ์ชื่อศิลปินหรือเพลง' });
  }

  let apiKey = process.env.GEMINI_API_KEY || '';
  apiKey = apiKey.replace(/[\s"']/g, '');

  if (!apiKey) {
    return res.status(500).json({ error: 'API Key ว่างเปล่า กรุณาเช็ค GEMINI_API_KEY ใน Vercel' });
  }

  const prompt = mode === 'song'
    ? buildSongPrompt(query)
    : buildArtistPrompt(query);

  try {
    // ใช้โมเดลใหม่ แนะนำแทน gemini-1.5-flash / gemini-2.0-flash
    const model = 'gemini-2.5-flash';

    const apiUrl = new URL(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
    );

    apiUrl.searchParams.set('key', apiKey);

    const geminiRes = await fetch(apiUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          temperature: 0.8,
          responseMimeType: 'application/json'
        }
      })
    });

    const rawText = await geminiRes.text();

    if (!geminiRes.ok) {
      return res.status(400).json({
        error: 'Google API Error: ' + rawText
      });
    }

    let data;
    try {
      data = JSON.parse(rawText);
    } catch (e) {
      return res.status(500).json({
        error: 'Google ส่งข้อมูลกลับมาไม่ใช่ JSON หลัก',
        raw: rawText
      });
    }

    let text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!text) {
      return res.status(500).json({
        error: 'AI ไม่ได้ส่งข้อความกลับมา',
        raw: data
      });
    }

    // กันกรณี AI ยังใส่ markdown กลับมา
    text = text
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();

    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');

    if (start === -1 || end === -1) {
      return res.status(500).json({
        error: 'AI ตอบกลับมาไม่ใช่รูปแบบ JSON',
        raw: text
      });
    }

    const jsonText = text.slice(start, end + 1);

    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch (e) {
      return res.status(500).json({
        error: 'แปลง JSON ไม่สำเร็จ: ' + e.message,
        raw: jsonText
      });
    }

    return res.status(200).json(parsed);

  } catch (err) {
    return res.status(500).json({
      error: 'รันโค้ดไม่สำเร็จ: ' + err.message
    });
  }
};

function buildSongPrompt(query) {
  return (
    'You are a music expert. The user likes this song: "' + query + '"\n\n' +
    'Identify the song, artist, and nationality. If Thai artist, recommend Thai songs first.\n\n' +
    'Respond ONLY with valid JSON starting with { — no markdown, no explanation:\n\n' +
    '{"identified":"Song - Artist (nationality)","songs":[{"name":"song","artist":"artist","why":"reason in Thai","tags":["tag1","tag2"]}]}\n\n' +
    'Provide exactly 6 songs. Write "why" and "tags" in Thai.'
  );
}

function buildArtistPrompt(query) {
  return (
    'You are a music expert. Find artists similar to: "' + query + '"\n\n' +
    'IMPORTANT: Some artists use English names but are Thai, for example blvckheart, NONT TANONT, URBOYTJ, YOUNGOHM, SPRITE. Verify nationality from their work, label, and collaborations.\n' +
    'If Thai artist, recommend Thai artists first.\n\n' +
    'Respond ONLY with valid JSON starting with { — no markdown, no explanation:\n\n' +
    '{"identified":"Artist (nationality)","bio":"2-3 sentences in Thai","nationality":"nationality in Thai","artists":[{"name":"artist","genre":"genre","why":"reason in Thai","tags":["tag1","tag2"],"wiki":"Wikipedia_title_or_empty","country":"ISO2 e.g. TH US KR"}]}\n\n' +
    'Provide exactly 5 artists. Write "bio", "why", "nationality", "tags" in Thai.'
  );
}
