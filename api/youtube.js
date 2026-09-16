// /api/youtube.js — YouTube MV Resolver with Fallback
module.exports = async function handler(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const query = String(req.query?.q || '').trim().slice(0, 120);
  if (!query) return res.status(400).json({ error: 'missing query' });

  const fallbackUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query + ' official mv')}`;

  try {
    const r = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(query + ' official mv')}&sp=EgIQAQ%253D%253D`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      }
    });

    if (!r.ok) return res.status(200).json({ videoId: null, fallbackUrl });
    const html = await r.text();
    const match = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
    return res.status(200).json({ videoId: match ? match[1] : null, fallbackUrl });
  } catch {
    return res.status(200).json({ videoId: null, fallbackUrl });
  }
};
