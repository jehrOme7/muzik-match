// /api/charts.js — Multi-region Apple Music Top Songs with 30s Audio Preview
const CACHE_TTL_MS = 60 * 60 * 1000;
const cacheStore = new Map();

module.exports = async function handler(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const country = ['th', 'us', 'kr'].includes((req.query?.country || '').toLowerCase()) 
    ? req.query.country.toLowerCase() 
    : 'us';
  const limit = Math.min(parseInt(req.query?.limit || '20', 10), 20);

  const cached = cacheStore.get(country);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json({ country, songs: cached.songs.slice(0, limit) });
  }

  try {
    const rssUrl = `https://itunes.apple.com/${country}/rss/topsongs/limit=25/json`;
    const r = await fetch(rssUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MuzikMatch/2.0)' } });
    if (!r.ok) throw new Error('RSS Error');

    const data = await r.json();
    const entries = data?.feed?.entry || [];

    const songs = entries.map((e, i) => {
      const images = Array.isArray(e['im:image']) ? e['im:image'] : [];
      const artwork = (images[images.length - 1]?.label || '').replace(/\/\d+x\d+bb\./, '/300x300bb.');
      const links = Array.isArray(e.link) ? e.link : (e.link ? [e.link] : []);
      const previewUrl = links.find(l => l?.attributes?.rel === 'enclosure' || l?.attributes?.type?.includes('audio'))?.attributes?.href || '';

      return {
        rank: i + 1,
        title: e['im:name']?.label || '',
        artist: e['im:artist']?.label || '',
        artwork,
        previewUrl
      };
    }).filter(s => s.title && s.artist).slice(0, 20);

    cacheStore.set(country, { songs, timestamp: Date.now() });
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json({ country, songs: songs.slice(0, limit) });
  } catch (err) {
    if (cached) return res.status(200).json({ country, songs: cached.songs.slice(0, limit), stale: true });
    return res.status(502).json({ error: 'ไม่สามารถโหลดชาร์ตได้ในขณะนี้' });
  }
};
