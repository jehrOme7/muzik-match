// ค้นหา YouTube video ID จากชื่อเพลง โดยใช้ YouTube oEmbed/scrape แบบเบาๆ
// ไม่ต้องใช้ YouTube API key แยก — ดึงจากหน้าผลค้นหาสาธารณะ

export default async function handler(req, res) {
  const query = (req.query?.q || '').toString().trim();
  if (!query) {
    return res.status(400).json({ error: 'missing query' });
  }

  try {
    const searchUrl = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(query);
    const ytRes = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    if (!ytRes.ok) {
      return res.status(200).json({ videoId: null });
    }

    const html = await ytRes.text();
    // หา videoId ตัวแรกจากผลค้นหา
    const match = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
    const videoId = match ? match[1] : null;

    // cache ที่ฝั่ง CDN เพื่อความเร็ว
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');
    return res.status(200).json({ videoId });
  } catch (err) {
    return res.status(200).json({ videoId: null });
  }
}
