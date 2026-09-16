// /api/search.js — AI Music Match & Freeform Vibe Search
const WINDOW_MS = 60 * 1000;
const MAX_REQ_PER_WINDOW = 30;
const buckets = new Map();

function setSecurityHeaders(res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
}

function getClientId(req) {
  return (req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown').toString().split(',')[0].trim();
}

function rateLimit(req, res) {
  const now = Date.now();
  const id = getClientId(req);
  const bucket = buckets.get(id) || { start: now, count: 0 };
  if (now - bucket.start > WINDOW_MS) {
    bucket.start = now;
    bucket.count = 0;
  }
  bucket.count += 1;
  buckets.set(id, bucket);

  if (buckets.size > 1000) {
    for (const [k, v] of buckets) {
      if (now - v.start > WINDOW_MS * 2) buckets.delete(k);
    }
  }

  if (bucket.count > MAX_REQ_PER_WINDOW) {
    res.status(429).json({ error: 'ใช้งานถี่เกินไป กรุณารอสักครู่' });
    return false;
  }
  return true;
}

function cleanQuery(val) {
  return String(val || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
}

function safeString(val, max) {
  return cleanQuery(val).slice(0, max);
}

function safeTags(tags) {
  return Array.isArray(tags) ? tags.slice(0, 5).map(t => safeString(t, 30)).filter(Boolean) : [];
}

module.exports = async function handler(req, res) {
  setSecurityHeaders(res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res)) return;

  const query = cleanQuery(req.body && req.body.query);
  const mode = cleanQuery((req.body && req.body.mode) || 'song').toLowerCase();

  if (!query) return res.status(400).json({ error: 'กรุณากรอกข้อความค้นหา' });
  if (query.length > 200) return res.status(400).json({ error: 'ข้อความยาวเกินกำหนด' });

  const keys = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
  ].filter(Boolean);

  if (!keys.length) return res.status(500).json({ error: 'ระบบยังไม่ได้ตั้งค่า API Key' });

  let prompt = '';
  if (mode === 'vibe') {
    prompt = `Analyze user's vibe: "${query}". Recommend 6 songs. Return ONLY valid JSON:
{"moodDetected":"Short Thai mood title","vibeSummary":"1-2 sentences in Thai","songs":[{"name":"song","artist":"artist","why":"reason in Thai","tags":["tag1","tag2"]}]}`;
  } else {
    prompt = `Find 6 songs for user who likes: "${query}". Return ONLY valid JSON:
{"songs":[{"name":"song","artist":"artist","why":"reason in Thai","tags":["tag1","tag2"]}]}`;
  }

  for (let k = 0; k < keys.length; k++) {
    try {
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${keys[k]}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.75 }
          })
        }
      );

      if (!resp.ok) continue;
      const data = await resp.json();
      let text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      text = text.replace(/```json/gi, '').replace(/```/g, '').trim();

      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start === -1 || end === -1) continue;

      const parsed = JSON.parse(text.slice(start, end + 1));
      return res.status(200).json(parsed);
    } catch {
      continue;
    }
  }

  return res.status(429).json({ error: 'ระบบมีผู้ใช้งานสูง กรุณาลองใหม่อีกครั้ง' });
};
