// /api/charts.js — Apple Music Top Songs via iTunes RSS (no API key needed)
// iTunes RSS feed: official Apple endpoint, free, no auth required
// Updates daily, returns top songs with artwork, artist, title, Apple Music link

const CACHE_TTL = 3600; // cache 1 hour (data updates daily anyway)
let cached = null;
let cachedAt = 0;

function setSecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', `public, s-maxage=${CACHE_TTL}, stale-while-revalidate`);
}

module.exports = async function handler(req, res) {
  setSecurityHeaders(res);

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const limit = Math.min(parseInt(req.query?.limit || '10', 10), 20);

  // serve from memory cache if fresh
  if (cached && Date.now() - cachedAt < CACHE_TTL * 1000) {
    return res.status(200).json({ songs: cached.slice(0, limit), cached: true });
  }

  try {
    // iTunes RSS JSON feed — official Apple, no auth, CORS-friendly from server
    const url = `https://itunes.apple.com/us/rss/topsongs/limit=20/json`;
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MuzikMatch/1.0)',
        'Accept': 'application/json'
      }
    });

    if (!r.ok) throw new Error(`iTunes RSS ${r.status}`);

    const data = await r.json();
    const entries = data?.feed?.entry || [];

    const songs = entries.slice(0, 20).map((e, i) => {
      // artwork: im:image array, last item = largest (170x170)
      const images = e['im:image'] || [];
      const artworkSm = images[0]?.label || '';
      const artworkLg = images[images.length - 1]?.label || '';
      // upgrade artwork to 300x300 by replacing size in URL
      const artwork = artworkLg.replace(/\/\d+x\d+bb/, '/300x300bb');

      // link to Apple Music / iTunes
      const links = Array.isArray(e.link) ? e.link : [e.link];
      const appleUrl = links.find(l => l?.attributes?.type === 'text/html')?.attributes?.href
        || links[0]?.attributes?.href || '';

      return {
        rank: i + 1,
        title: e['im:name']?.label || '',
        artist: e['im:artist']?.label || '',
        artwork,
        appleUrl,
        // build Spotify search URL as fallback listen link
        spotifyUrl: `https://open.spotify.com/search/${encodeURIComponent((e['im:name']?.label || '') + ' ' + (e['im:artist']?.label || ''))}/tracks`,
      };
    }).filter(s => s.title && s.artist);

    cached = songs;
    cachedAt = Date.now();
    return res.status(200).json({ songs: songs.slice(0, limit), cached: false });

  } catch (err) {
    console.error('charts error:', err.message);
    // fallback: if cache is stale but exists, still serve it
    if (cached) return res.status(200).json({ songs: cached.slice(0, limit), cached: true, stale: true });
    return res.status(502).json({ error: 'ไม่สามารถดึงข้อมูล chart ได้ กรุณาลองใหม่' });
  }
};
