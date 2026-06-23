module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const query = ((req.body && req.body.query) || '').toString().trim();
  const mode  = ((req.body && req.body.mode)  || 'artist').toString();

  if (!query) return res.status(400).json({ error: 'กรุณาพิมพ์ชื่อศิลปินหรือเพลง' });

  // 1. ตรวจสอบ API Key จาก Vercel
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ลืมใส่ API Key ใน Vercel หรือตั้งชื่อตัวแปรไม่ตรง' });

  var prompt = mode === 'song' ? buildSongPrompt(query) : buildArtistPrompt(query);

  try {
    var geminiRes = await fetch(
      // 2. เปลี่ยนมาใช้ gemini-1.5-flash ที่เสถียรและได้โควต้าเยอะกว่า
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + apiKey,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.8 }
        })
      }
    );

    // 3. เลิกซ่อน Error ของ Google - ถ้าเชื่อมต่อไม่ผ่าน ให้แสดงสาเหตุจริงออกหน้าเว็บเลย
    if (!geminiRes.ok) {
      var errData = await geminiRes.json().catch(function(){ return {}; });
      return res.status(400).json({ error: 'Google แจ้งว่า: ' + JSON.stringify(errData) });
    }

    var data = await geminiRes.json();
    var text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // ทำความสะอาด JSON
    text = text.replace(/```json/gi, '').replace(/
```/g, '').trim();

    var start = text.indexOf('{');
    var end   = text.lastIndexOf('}');
    if (start === -1 || end === -1) {
      return res.status(500).json({ error: 'AI ตอบกลับผิดรูปแบบ (ไม่ใช่ JSON)' });
    }
    text = text.slice(start, end + 1);

    var parsed = JSON.parse(text);
    return res.status(200).json(parsed);

  } catch (err) {
    return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการรันโค้ด: ' + err.message });
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
