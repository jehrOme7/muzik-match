// /api/charts.js — Apple Music Top Songs via iTunes RSS
// Official Apple feed · ฟรี ไม่ต้อง API key · อัปเดตทุกวัน
// วางไฟล์นี้ที่ api/charts.js ใน Vercel project

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 ชั่วโมง
let memCache = null;
let memCachedAt = 0;

module.exports = async function handler(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const limit = Math.min(parseInt(req.query?.limit || '20', 10), 20);

  // serve memory cache ถ้ายังสด
  if (memCache && Date.now() - memCachedAt < CACHE_TTL_MS) {
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json({ songs: memCache.slice(0, limit) });
  }

  try {
    const r = await fetch('https://itunes.apple.com/us/rss/topsongs/limit=20/json', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MuzikMatch/2.0)' },
    });
    if (!r.ok) throw new Error('iTunes RSS ' + r.status);

    const data = await r.json();
    const entries = data?.feed?.entry || [];

    const songs = entries.map((e, i) => {
      const images = Array.isArray(e['im:image']) ? e['im:image'] : [];
      const artworkRaw = (images[images.length - 1]?.label || '');
      const artwork = artworkRaw.replace(/\/\d+x\d+bb\./, '/300x300bb.');

      const links = Array.isArray(e.link) ? e.link : (e.link ? [e.link] : []);
      const appleUrl = links.find(l => l?.attributes?.type === 'text/html')?.attributes?.href
        || links[0]?.attributes?.href || '';

      const title  = e['im:name']?.label  || '';
      const artist = e['im:artist']?.label || '';

      return {
        rank: i + 1,
        title,
        artist,
        artwork,
        appleUrl,
      };
    }).filter(s => s.title && s.artist);

    memCache = songs;
    memCachedAt = Date.now();
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json({ songs: songs.slice(0, limit) });

  } catch (err) {
    console.error('[charts] fetch error:', err.message);
    if (memCache) {
      res.setHeader('Cache-Control', 'public, s-maxage=60');
      return res.status(200).json({ songs: memCache.slice(0, limit), stale: true });
    }
    return res.status(502).json({ error: 'โหลด chart ไม่ได้ในขณะนี้' });
  }
};
