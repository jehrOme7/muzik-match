// /api/search.js — secured version
// Backend proxy for Gemini. Keep API keys only in Vercel Environment Variables.

const WINDOW_MS = 60 * 1000;
const MAX_REQ_PER_WINDOW = 30;
const buckets = new Map();

function setSecurityHeaders(res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
}

function getClientId(req) {
  return (
    req.headers['x-forwarded-for'] ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    'unknown'
  ).toString().split(',')[0].trim();
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

  // lightweight cleanup for long-lived server instances
  if (buckets.size > 1000) {
    for (const [key, value] of buckets) {
      if (now - value.start > WINDOW_MS * 2) buckets.delete(key);
    }
  }

  if (bucket.count > MAX_REQ_PER_WINDOW) {
    res.status(429).json({ error: 'มีการใช้งานถี่เกินไป กรุณาลองใหม่อีกครั้งในสักครู่' });
    return false;
  }
  return true;
}

function isAllowedOrigin(req) {
  const allowed = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  // If not configured, stay same-origin friendly and do not emit permissive CORS.
  if (!allowed.length) return true;

  const origin = req.headers.origin;
  // Non-browser/server-to-server requests may have no Origin.
  if (!origin) return true;
  return allowed.includes(origin);
}

function cleanQuery(value) {
  return String(value || '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function safeString(value, maxLen) {
  return String(value || '').replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, maxLen);
}

function safeTags(tags) {
  return Array.isArray(tags) ? tags.slice(0, 5).map(t => safeString(t, 30)).filter(Boolean) : [];
}

function normalizeArtistResponse(parsed) {
  const artists = Array.isArray(parsed.artists) ? parsed.artists.slice(0, 5).map(a => ({
    name: safeString(a && a.name, 80),
    genre: safeString(a && a.genre, 80),
    why: safeString(a && a.why, 260),
    tags: safeTags(a && a.tags),
    wiki: safeString(a && a.wiki, 120),
    country: safeString(a && a.country, 2).toUpperCase()
  })).filter(a => a.name) : [];

  return {
    identified: safeString(parsed.identified, 120),
    bio: safeString(parsed.bio, 360),
    nationality: safeString(parsed.nationality, 80),
    artists
  };
}

function normalizeSongResponse(parsed) {
  const songs = Array.isArray(parsed.songs) ? parsed.songs.slice(0, 6).map(s => ({
    name: safeString(s && s.name, 100),
    artist: safeString(s && s.artist, 100),
    why: safeString(s && s.why, 260),
    tags: safeTags(s && s.tags)
  })).filter(s => s.name || s.artist) : [];

  return {
    identified: safeString(parsed.identified, 140),
    songs
  };
}

module.exports = async function handler(req, res) {
  setSecurityHeaders(res);

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!isAllowedOrigin(req)) {
    return res.status(403).json({ error: 'Origin not allowed' });
  }

  if (!rateLimit(req, res)) return;

  const contentType = String(req.headers['content-type'] || '');
  if (contentType && !contentType.includes('application/json')) {
    return res.status(415).json({ error: 'Content-Type must be application/json' });
  }

  const query = cleanQuery(req.body && req.body.query);
  const mode = cleanQuery((req.body && req.body.mode) || 'artist').toLowerCase();

  if (!['artist', 'song'].includes(mode)) {
    return res.status(400).json({ error: 'mode ไม่ถูกต้อง' });
  }
  if (!query) return res.status(400).json({ error: 'กรุณาพิมพ์ชื่อศิลปินหรือเพลง' });
  if (query.length > 100) return res.status(400).json({ error: 'ข้อความยาวเกินไป' });

  const keys = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
  ].filter(Boolean);

  if (!keys.length) return res.status(500).json({ error: 'ระบบยังไม่ได้ตั้งค่า API key' });

  const prompt = mode === 'song' ? buildSongPrompt(query) : buildArtistPrompt(query);

  for (let ki = 0; ki < keys.length; ki++) {
    try {
      const geminiRes = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + keys[ki],
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
        console.log('429 on key', ki, '— trying next');
        continue;
      }

      if (!geminiRes.ok) {
        const errData = await geminiRes.json().catch(() => ({}));
        return res.status(502).json({ error: 'AI error: ' + ((errData.error && errData.error.message) || geminiRes.status) });
      }

      const data = await geminiRes.json();
      let text = (
        data.candidates &&
        data.candidates[0] &&
        data.candidates[0].content &&
        data.candidates[0].content.parts &&
        data.candidates[0].content.parts[0] &&
        data.candidates[0].content.parts[0].text
      ) || '';

      text = text.replace(/```json/gi, '').replace(/```/g, '').trim();

      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start === -1 || end === -1) {
        console.log('No JSON, retrying next key. text:', text.slice(0, 100));
        continue;
      }
      text = text.slice(start, end + 1);

      try {
        const parsed = JSON.parse(text);
        const normalized = mode === 'song' ? normalizeSongResponse(parsed) : normalizeArtistResponse(parsed);
        return res.status(200).json(normalized);
      } catch (parseErr) {
        console.log('Parse error:', parseErr.message);
        continue;
      }
    } catch (fetchErr) {
      console.log('Fetch error:', fetchErr.message);
      continue;
    }
  }

  return res.status(429).json({ error: 'ระบบมีผู้ใช้งานสูงในขณะนี้ กรุณาลองใหม่อีกครั้งในสักครู่' });
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
