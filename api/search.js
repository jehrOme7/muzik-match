// รองรับ API key หลายอัน + retry อัตโนมัติ
// ตั้งค่าใน Vercel Environment Variables:
//   GEMINI_API_KEY   = key หลัก (จำเป็น)
//   GEMINI_API_KEY_2 = key สำรองอัน 2 (ไม่บังคับ)
//   GEMINI_API_KEY_3 = key สำรองอัน 3 (ไม่บังคับ)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const query = (req.body?.query || '').toString().trim();
  const mode  = (req.body?.mode  || 'artist').toString();
  if (!query) return res.status(400).json({ error: 'กรุณาพิมพ์ชื่อศิลปินหรือเพลง' });
  if (query.length > 100) return res.status(400).json({ error: 'ข้อความยาวเกินไป' });

  // รวบรวม key ทุกอันที่ตั้งไว้
  const keys = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
  ].filter(Boolean);

  if (!keys.length) {
    return res.status(500).json({ error: 'ระบบยังไม่ได้ตั้งค่า API key' });
  }

  // สร้าง prompt ตาม mode
  const prompt = mode === 'song' ? buildSongPrompt(query) : buildArtistPrompt(query);

  const RETRY_DELAYS = [0, 1000, 2000]; // ms รอก่อน retry แต่ละรอบ

  // วนลอง: key สำรอง × retry
  for (const key of keys) {
    for (let attempt = 0; attempt < RETRY_DELAYS.length; attempt++) {
      if (RETRY_DELAYS[attempt] > 0) {
        await sleep(RETRY_DELAYS[attempt]);
      }
      try {
        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.85, responseMimeType: 'application/json' }
            })
          }
        );

        // สำเร็จ!
        if (geminiRes.ok) {
          const data = await geminiRes.json();
          let text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          // ลบ markdown code block ถ้า AI ใส่มา
          text = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
          const parsed = JSON.parse(text);
          return res.status(200).json(parsed);
        }

        // 429 → ลองใหม่ (หรือสลับ key ถัดไป)
        if (geminiRes.status === 429) {
          continue; // ลอง retry กับ key นี้ก่อน
        }

        // error อื่นๆ ที่ไม่ใช่ 429 → ไม่ retry
        const errData = await geminiRes.json().catch(() => ({}));
        return res.status(500).json({
          error: 'เกิดข้อผิดพลาดจาก AI: ' + (errData?.error?.message || geminiRes.status)
        });

      } catch (err) {
        // network error → retry
        if (attempt === RETRY_DELAYS.length - 1) continue; // หมด retry ของ key นี้ → สลับ key
      }
    }
    // key นี้ retry หมดแล้ว → สลับไป key ถัดไป
  }

  // ทุก key และทุก retry หมดแล้ว
  return res.status(429).json({
    error: 'ระบบมีผู้ใช้งานสูงในขณะนี้ กรุณาลองใหม่อีกครั้งในสักครู่'
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function buildSongPrompt(query) {
  return `คุณคือผู้เชี่ยวชาญด้านดนตรีที่รู้จักเพลงและศิลปินทั้งไทยและสากลอย่างลึกซึ้ง

ผู้ใช้ใส่ชื่อเพลง: "${query}"

ขั้นตอนการคิด (ทำในใจ ไม่ต้องแสดง):
1. ระบุให้ชัดว่าเพลงนี้คือเพลงอะไร ของศิลปินคนไหน สัญชาติอะไร
2. วิเคราะห์แนวเพลง อารมณ์ ยุคสมัย จังหวะ และสไตล์การผลิต
3. ถ้าเป็นเพลงของศิลปินไทย ให้เน้นแนะนำเพลงไทย/เอเชียที่สไตล์ใกล้เคียงก่อน

ตอบกลับเป็น JSON เท่านั้น ห้ามมีข้อความอื่นนอก JSON ห้ามมี markdown code block
รูปแบบ:
{
  "identified": "ชื่อเพลง - ชื่อศิลปิน (สัญชาติ)",
  "songs": [
    {"name": "ชื่อเพลง", "artist": "ศิลปิน", "why": "เหตุผลสั้นๆ (1 ประโยค)", "tags": ["แท็ก1", "แท็ก2"]}
  ]
}
ให้ songs 6 รายการ ตอบเป็นภาษาไทย (ยกเว้นชื่อที่เป็นภาษาอังกฤษอยู่แล้ว)`;
}

function buildArtistPrompt(query) {
  return `คุณคือผู้เชี่ยวชาญด้านดนตรีที่รู้จักเพลงและศิลปินทั้งไทยและสากลอย่างลึกซึ้ง

ผู้ใช้ใส่ชื่อศิลปิน: "${query}"

ขั้นตอนการคิด (ทำในใจ ไม่ต้องแสดง):
1. ระบุให้ชัดว่าศิลปินนี้คือใคร — สำคัญมาก: ศิลปินบางคนใช้ชื่อภาษาอังกฤษแต่เป็นคนไทย เช่น blvckheart, NONT TANONT, URBOYTJ, YOUNGOHM, SPRITE — ต้องตรวจสอบสัญชาติจริงๆ จากผลงาน ค่าย และคนที่เคย feat. ด้วย
2. สรุป bio สั้นๆ
3. แนะนำศิลปินที่แนวเพลงใกล้เคียง เน้นสัญชาติเดียวกันก่อน

ตอบกลับเป็น JSON เท่านั้น ห้ามมีข้อความอื่นนอก JSON ห้ามมี markdown code block
รูปแบบ:
{
  "identified": "ชื่อศิลปิน (สัญชาติ)",
  "bio": "ประวัติย่อ 2-3 ประโยค",
  "nationality": "สัญชาติ",
  "artists": [
    {"name": "ชื่อศิลปิน", "genre": "แนวเพลง", "why": "เหตุผลสั้นๆ (1 ประโยค)", "tags": ["แท็ก1", "แท็ก2"], "wiki": "ชื่อ Wikipedia ภาษาอังกฤษ ใช้ _ แทนเว้นวรรค ถ้าไม่มีใส่ empty string", "country": "รหัส ISO 3166-1 alpha-2 เช่น TH US KR JP GB"}
  ]
}
ให้ artists 5 รายการ ตอบเป็นภาษาไทย (ยกเว้นชื่อที่เป็นภาษาอังกฤษอยู่แล้ว)`;
}
ให้ artists 5 รายการ ตอบเป็นภาษาไทย (ยกเว้นชื่อที่เป็นภาษาอังกฤษอยู่แล้ว)`;
}
