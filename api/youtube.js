// /api/youtube.js — secured version
// ค้นหา YouTube video ID จากชื่อเพลง โดยไล่ priority:
// official mv > official audio > official lyrics video > lyrics video
// กรอง Shorts และคลิปแสดงสดออก โดยไม่ต้องใช้ YouTube API key

const WINDOW_MS = 60 * 1000;
const MAX_REQ_PER_WINDOW = 60;
const buckets = new Map();

function setSecurityHeaders(res) {
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

  if (buckets.size > 1000) {
    for (const [key, value] of buckets) {
      if (now - value.start > WINDOW_MS * 2) buckets.delete(key);
    }
  }

  if (bucket.count > MAX_REQ_PER_WINDOW) {
    res.status(429).json({ error: 'too many requests' });
    return false;
  }
  return true;
}

function cleanQuery(value) {
  return String(value || '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = async function handler(req, res) {
  setSecurityHeaders(res);

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!rateLimit(req, res)) return;

  const query = cleanQuery(req.query?.q);
  if (!query) {
    return res.status(400).json({ error: 'missing query' });
  }
  if (query.length > 120) {
    return res.status(400).json({ error: 'query too long' });
  }

  const avoidKeywords = ['reaction', 'cover', 'live performance', 'fancam', 'tiktok', 'shorts', 'sped up', 'slowed'];

  async function searchYoutube(searchTerm) {
    const url = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(searchTerm) + '&sp=EgIQAQ%253D%253D';
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    if (!r.ok) return [];
    const html = await r.text();

    const results = [];
    const seen = new Set();
    const idMatches = [...html.matchAll(/"videoRenderer":\{"videoId":"([a-zA-Z0-9_-]{11})"/g)];
    for (const idm of idMatches) {
      const id = idm[1];
      if (seen.has(id)) continue;
      seen.add(id);
      const idx = idm.index;
      const chunk = html.slice(idx, idx + 1200);
      const titleMatch = chunk.match(/"title":\{"runs":\[\{"text":"([^"]*?)"/);
      const lengthMatch = chunk.match(/"lengthText":\{[^}]*?"simpleText":"([^"]*?)"/);
      const title = titleMatch ? titleMatch[1] : '';
      const lengthStr = lengthMatch ? lengthMatch[1] : '';
      results.push({ id, title, lengthStr });
      if (results.length >= 10) break;
    }
    return results;
  }

  function lengthToSeconds(str) {
    if (!str) return 0;
    const parts = str.split(':').map(n => parseInt(n, 10)).filter(n => !isNaN(n));
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return 0;
  }

  function pickBest(videos) {
    const scored = videos.map(v => {
      const t = (v.title || '').toLowerCase();
      let score = 0;
      for (const k of avoidKeywords) if (t.includes(k)) score -= 6;
      const secs = lengthToSeconds(v.lengthStr);
      if (secs > 0 && secs < 70) score -= 6;
      if (secs > 720) score -= 3;
      if (secs >= 120 && secs <= 420) score += 1;
      return { ...v, score };
    });
    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];
    if (!best || best.score <= -6) return null;
    return best.id;
  }

  try {
    const tiers = [
      `${query} official mv`,
      `${query} official music video`,
      `${query} official audio`,
      `${query} official lyrics video`,
      `${query} lyrics video`,
      `${query} lyrics`,
      query
    ];

    let videoId = null;
    for (const term of tiers) {
      const videos = await searchYoutube(term);
      const picked = pickBest(videos);
      if (picked) { videoId = picked; break; }
    }

    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');
    return res.status(200).json({ videoId });
  } catch (err) {
    return res.status(200).json({ videoId: null });
  }
};
