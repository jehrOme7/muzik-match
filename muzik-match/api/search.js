export default async function handler(req, res) {
  // อนุญาตเฉพาะ POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const query = (req.body?.query || '').toString().trim();
  if (!query) {
    return res.status(400).json({ error: 'กรุณาพิมพ์ชื่อเพลงหรือศิลปิน' });
  }
  if (query.length > 100) {
    return res.status(400).json({ error: 'ข้อความยาวเกินไป' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ระบบยังไม่ได้ตั้งค่า API key' });
  }

  const prompt = `คุณคือผู้เชี่ยวชาญด้านดนตรีที่รู้จักเพลงและศิลปินทั้งไทยและสากล

ผู้ใช้ชอบ: "${query}"

ช่วยแนะนำสิ่งที่ใกล้เคียงโดยวิเคราะห์จากแนวเพลง อารมณ์ ยุคสมัย และสไตล์การร้อง/ดนตรี

ตอบกลับเป็น JSON เท่านั้น ห้ามมีข้อความอื่นนอก JSON ห้ามมี markdown code block
รูปแบบ:
{
  "artists": [
    {"name": "ชื่อศิลปิน", "genre": "แนวเพลง", "why": "เหตุผลสั้นๆ ว่าทำไมถึงใกล้เคียง (1 ประโยค)", "tags": ["แท็ก1", "แท็ก2"], "wiki": "ชื่อบทความ Wikipedia ภาษาอังกฤษของศิลปินนี้ เช่น Bodyslam_(band) หรือ Taylor_Swift"}
  ],
  "songs": [
    {"name": "ชื่อเพลง", "artist": "ศิลปิน", "why": "เหตุผลสั้นๆ", "tags": ["แท็ก1", "แท็ก2"]}
  ]
}

สำหรับ wiki: ใส่ชื่อบทความ Wikipedia ภาษาอังกฤษที่ถูกต้องของศิลปิน (ใช้ _ แทนเว้นวรรค) ถ้าไม่แน่ใจว่ามีบทความ ให้ใส่ค่าว่าง ""
ให้ artists 4 รายการ และ songs 4 รายการ ตอบเป็นภาษาไทย (ยกเว้นชื่อเพลง/ศิลปินที่เป็นภาษาอังกฤษอยู่แล้ว)`;

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.9, responseMimeType: 'application/json' }
        })
      }
    );

    if (!geminiRes.ok) {
      const errData = await geminiRes.json().catch(() => ({}));
      if (geminiRes.status === 429) {
        return res.status(429).json({ error: 'ตอนนี้มีคนใช้เยอะ ลองใหม่อีกครั้งในสักครู่' });
      }
      return res.status(500).json({ error: 'เกิดข้อผิดพลาดจาก AI: ' + (errData?.error?.message || geminiRes.status) });
    }

    const data = await geminiRes.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const parsed = JSON.parse(text);
    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: 'เกิดข้อผิดพลาด ลองใหม่อีกครั้ง' });
  }
}
