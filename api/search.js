export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const query = (req.body?.query || '').toString().trim();
  const mode = (req.body?.mode || 'artist').toString();
  if (!query) {
    return res.status(400).json({ error: 'กรุณาพิมพ์ชื่อศิลปินหรือเพลง' });
  }
  if (query.length > 100) {
    return res.status(400).json({ error: 'ข้อความยาวเกินไป' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ระบบยังไม่ได้ตั้งค่า API key' });
  }

  let prompt;
  if (mode === 'song') {
    prompt = `คุณคือผู้เชี่ยวชาญด้านดนตรีที่รู้จักเพลงและศิลปินทั้งไทยและสากลอย่างลึกซึ้ง

ผู้ใช้ใส่ชื่อเพลง: "${query}"

ขั้นตอนการคิด (ทำในใจ ไม่ต้องแสดง):
1. ระบุให้ชัดว่าเพลงนี้คือเพลงอะไร ของศิลปินคนไหน สัญชาติอะไร
2. วิเคราะห์แนวเพลง อารมณ์ ยุคสมัย จังหวะ และสไตล์การผลิต
3. ถ้าเป็นเพลงของศิลปินไทย ให้เน้นแนะนำเพลงไทย/เอเชียที่สไตล์ใกล้เคียงก่อนเป็นหลัก แล้วค่อยเสริมเพลงสากลถ้าเหมาะ
4. ถ้าเป็นเพลงสากล ก็แนะนำตามแนวที่ใกล้เคียงจริง

ตอบกลับเป็น JSON เท่านั้น ห้ามมีข้อความอื่นนอก JSON ห้ามมี markdown code block
รูปแบบ:
{
  "identified": "ชื่อเพลง - ชื่อศิลปิน (สัญชาติ)",
  "songs": [
    {"name": "ชื่อเพลง", "artist": "ศิลปิน", "why": "เหตุผลสั้นๆ ว่าทำไมสไตล์ใกล้เคียง (1 ประโยค)", "tags": ["แท็ก1", "แท็ก2"]}
  ]
}

ให้ songs 6 รายการ ตอบเป็นภาษาไทย (ยกเว้นชื่อเพลง/ศิลปินที่เป็นภาษาอังกฤษอยู่แล้ว)`;
  } else {
    prompt = `คุณคือผู้เชี่ยวชาญด้านดนตรีที่รู้จักเพลงและศิลปินทั้งไทยและสากลอย่างลึกซึ้ง

ผู้ใช้ใส่ชื่อศิลปิน: "${query}"

ขั้นตอนการคิด (ทำในใจ ไม่ต้องแสดง):
1. ระบุให้ชัดว่าศิลปินนี้คือใคร — สำคัญมาก: ศิลปินบางคนใช้ชื่อภาษาอังกฤษแต่เป็นคนไทย (เช่น blvckheart, NONT TANONT, URBOYTJ) ต้องตรวจสอบให้แน่ใจเรื่องสัญชาติจริงๆ ดูจากผลงาน ค่าย เพลง และคนที่เคย feat. ด้วย
2. ถ้าไม่แน่ใจว่าเป็นใคร ให้เลือกศิลปินที่เป็นไปได้มากที่สุดจากบริบท
3. สรุป bio สั้นๆ ของศิลปินคนนี้
4. แนะนำศิลปินที่แนวเพลงใกล้เคียง โดย**เน้นสัญชาติเดียวกันก่อน** — ถ้าเป็นศิลปินไทย ให้แนะนำศิลปินไทย/เอเชียที่สไตล์ใกล้เคียงเป็นหลัก แล้วค่อยเสริมศิลปินสากลถ้าเหมาะสมจริง

ตอบกลับเป็น JSON เท่านั้น ห้ามมีข้อความอื่นนอก JSON ห้ามมี markdown code block
รูปแบบ:
{
  "identified": "ชื่อศิลปิน (สัญชาติ)",
  "bio": "ประวัติย่อ 2-3 ประโยค บอกว่าเป็นใคร แนวเพลงอะไร สัญชาติอะไร มีผลงานเด่นอะไร",
  "nationality": "สัญชาติของศิลปิน เช่น ไทย หรือ สากล",
  "artists": [
    {"name": "ชื่อศิลปิน", "genre": "แนวเพลง", "why": "เหตุผลสั้นๆ ว่าทำไมใกล้เคียง (1 ประโยค)", "tags": ["แท็ก1", "แท็ก2"], "wiki": "ชื่อบทความ Wikipedia ภาษาอังกฤษ ใช้ _ แทนเว้นวรรค ถ้าไม่มีให้ใส่ \"\""}
  ]
}

ให้ artists 5 รายการ ตอบเป็นภาษาไทย (ยกเว้นชื่อศิลปินที่เป็นภาษาอังกฤษอยู่แล้ว)`;
  }

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.85, responseMimeType: 'application/json' }
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
