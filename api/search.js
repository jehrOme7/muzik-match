export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const query = (req.body?.query || '').toString().trim();
  const mode  = (req.body?.mode  || 'artist').toString();
  if (!query) return res.status(400).json({ error: 'กรุณาพิมพ์ชื่อศิลปินหรือเพลง' });
  if (query.length > 100) return res.status(400).json({ error: 'ข้อความยาวเกินไป' });

  const keys = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
  ].filter(Boolean);

  if (!keys.length) return res.status(500).json({ error: 'ระบบยังไม่ได้ตั้งค่า API key' });

  const prompt = mode === 'song' ? buildSongPrompt(query) : buildArtistPrompt(query);

  for (const key of keys) {
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await sleep(attempt * 1000);
      try {
        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.8,
                // ไม่ใช้ responseMimeType เพื่อกัน Gemini บางเวอร์ชันที่ไม่รองรับ
              }
            })
          }
        );

        if (geminiRes.status === 429) continue;

        if (!geminiRes.ok) {
          const errData = await geminiRes.json().catch(() => ({}));
          return res.status(500).json({
            error: 'เกิดข้อผิดพลาดจาก AI: ' + (errData?.error?.message || geminiRes.status)
          });
        }

        const data = await geminiRes.json();
        let text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

        // clean ทุกรูปแบบที่ Gemini อาจส่งมา
        text = text
          .replace(/^[\s\S]*?```json\s*/i, '') // ลบทุกอย่างก่อน ```json
          .replace(/^[\s\S]*?```\s*/i, '')      // ลบทุกอย่างก่อน ```
          .replace(/```[\s\S]*$/i, '')           // ลบทุกอย่างหลัง ```
          .trim();

        // ถ้ายังไม่เป็น JSON (ไม่ขึ้นต้นด้วย {) ให้ log แล้วลองใหม่
        if (!text.startsWith('{')) {
          console.error('Non-JSON response:', text.slice(0, 200));
          continue;
        }

        try {
          const parsed = JSON.parse(text);
          return res.status(200).json(parsed);
        } catch (parseErr) {
          console.error('Parse error:', parseErr.message, 'text:', text.slice(0, 300));
          continue;
        }

      } catch (err) {
        console.error('Fetch error:', err.message);
        if (attempt === 2) continue;
      }
    }
  }

  return res.status(429).json({
    error: 'ระบบมีผู้ใช้งานสูงในขณะนี้ กรุณาลองใหม่อีกครั้งในสักครู่'
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function buildSongPrompt(query) {
  return `You are a music expert. The user likes this song: "${query}"

Analyze the genre, mood, era, rhythm, and style. If it's a Thai artist, prioritize recommending Thai/Asian songs first.

Respond ONLY with a valid JSON object. No markdown, no code blocks, no explanation. Start your response directly with {

{
  "identified": "Song name - Artist (nationality)",
  "songs": [
    {"name": "song name", "artist": "artist name", "why": "brief reason in Thai (1 sentence)", "tags": ["tag1", "tag2"]}
  ]
}

Provide exactly 6 songs. Write "why" and "tags" in Thai language.`;
}

function buildArtistPrompt(query) {
  return `You are a music expert. The user wants to find artists similar to: "${query}"

Important: Some artists use English names but are Thai (e.g. blvckheart, NONT TANONT, URBOYTJ, YOUNGOHM). Check carefully using their work, label, and collaborations.

If the artist is Thai, prioritize recommending Thai/Asian artists first.

Respond ONLY with a valid JSON object. No markdown, no code blocks, no explanation. Start your response directly with {

{
  "identified": "Artist name (nationality)",
  "bio": "2-3 sentence bio in Thai",
  "nationality": "nationality in Thai",
  "artists": [
    {"name": "artist name", "genre": "genre", "why": "brief reason in Thai (1 sentence)", "tags": ["tag1", "tag2"], "wiki": "English Wikipedia article title using underscores, empty string if unknown", "country": "ISO 3166-1 alpha-2 code e.g. TH US KR JP GB"}
  ]
}

Provide exactly 5 artists. Write "bio", "why", "nationality", and "tags" in Thai language.`;
}
