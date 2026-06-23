// ค้นหา YouTube video ID จากชื่อเพลง โดยไล่ priority:
// official mv > official audio > official lyrics video > lyrics video
// กรอง Shorts และคลิปแสดงสดออก โดยไม่ต้องใช้ YouTube API key

export default async function handler(req, res) {
  const query = (req.query?.q || '').toString().trim();
  if (!query) {
    return res.status(400).json({ error: 'missing query' });
  }

  // คำที่ห้ามเอา (ไม่ว่าจะค้นด้วย term ไหน)
  const avoidKeywords = ['reaction', 'cover', 'live performance', 'fancam', 'tiktok', 'shorts', 'sped up', 'slowed'];

  async function searchYoutube(searchTerm) {
    // sp=EgIQAQ%3D%3D = filter "Videos only" (ตัด Shorts/Playlists/Channels)
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
    if (parts.length === 3) return parts[0]*3600 + parts[1]*60 + parts[2];
    if (parts.length === 2) return parts[0]*60 + parts[1];
    return 0;
  }

  // เลือกวิดีโอที่ดีที่สุดจากผลค้นหา 1 ชุด (คืน null ถ้าไม่มีตัวที่เหมาะ)
  function pickBest(videos) {
    const scored = videos.map(v => {
      const t = (v.title || '').toLowerCase();
      let score = 0;
      for (const k of avoidKeywords) if (t.includes(k)) score -= 6;
      const secs = lengthToSeconds(v.lengthStr);
      if (secs > 0 && secs < 70) score -= 6;       // ตัด short
      if (secs > 720) score -= 3;                   // คลิปยาวผิดปกติ
      if (secs >= 120 && secs <= 420) score += 1;   // เพลงความยาวปกติ
      return { ...v, score };
    });
    scored.sort((a, b) => b.score - a.score);
    // เอาเฉพาะตัวที่ไม่ติดลบมาก (กันกรณีทั้งชุดเป็น short/live)
    const best = scored[0];
    if (!best || best.score <= -6) return null;
    return best.id;
  }

  try {
    // ไล่ค้นตาม priority — เจอแล้วหยุดทันที
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
}
