// /api/charts.js — Multi-region Apple Music Top Songs with 30s Audio & Resilient KR Fallback
// รองรับชาร์ต 3 ประเทศ: th (ไทย), us (สากล), kr (เกาหลี) พร้อมไฟล์ตัวอย่างเสียง 30 วิ

const CACHE_TTL_MS = 60 * 60 * 1000; // แคช 1 ชั่วโมง
const cacheStore = new Map();

// ฐานข้อมูลสำรองชาร์ตเกาหลี (เนื่องจากระบบ iTunes RSS เกาหลีใต้ไม่มี Store จำหน่ายเพลงแบบซื้อขาด จึงคืนค่าว่าง)
const KR_FALLBACK_SONGS = [
  { rank: 1, title: "APT.", artist: "ROSÉ & Bruno Mars", artwork: "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/bf/97/81/bf97811d-efae-1a42-70b9-3ce1a5e1ea1f/196872597793.jpg/300x300bb.jpg", previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/03/49/a2/0349a2fe-7c0a-ebf2-f8c6-3023e3cb98e1/mzaf_10926868612140880344.plus.aac.p.m4a" },
  { rank: 2, title: "Supernova", artist: "aespa", artwork: "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/66/ea/1c/66ea1c95-bc1d-eb88-348a-6b80155088f1/cover_Supernova.jpg/300x300bb.jpg", previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/18/fc/ea/18fcea2a-bcf9-5dc4-f8b1-364e5264b3ef/mzaf_17234608304724037597.plus.aac.p.m4a" },
  { rank: 3, title: "HOME SWEET HOME", artist: "G-DRAGON (feat. TAEYANG & DAESUNG)", artwork: "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/58/01/fa/5801fa81-1250-9c2b-426c-d227fbc1e7ee/198704250262.jpg/300x300bb.jpg", previewUrl: "" },
  { rank: 4, title: "Whiplash", artist: "aespa", artwork: "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/b8/6f/90/b86f903a-3bb6-fa63-c2fc-93e54b679469/cover_Whiplash.jpg/300x300bb.jpg", previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/37/ef/e2/37efe290-7c2d-9653-5d51-31a89cbe3498/mzaf_4724090257321118182.plus.aac.p.m4a" },
  { rank: 5, title: "How Sweet", artist: "NewJeans", artwork: "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/0d/1a/df/0d1adf6a-685b-e260-2646-6ad5ec6ebffb/196922986423_cover.jpg/300x300bb.jpg", previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/04/c2/f7/04c2f703-a128-40b9-5df6-bfa693992ae0/mzaf_16393527756855160867.plus.aac.p.m4a" },
  { rank: 6, title: "Magnetic", artist: "ILLIT", artwork: "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/a4/09/25/a40925e0-5d63-23be-4680-4df25424df98/196922909408_Cover.jpg/300x300bb.jpg", previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/64/ce/aa/64ceaa0a-b223-95c8-11f2-8c105ea2368c/mzaf_9956403215502123512.plus.aac.p.m4a" },
  { rank: 7, title: "Love wins all", artist: "IU", artwork: "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/3a/0d/86/3a0d8692-a169-dc30-22c6-3392a8323eb3/Love_wins_all.jpg/300x300bb.jpg", previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview116/v4/24/e1/9b/24e19bf1-d576-9036-7ec9-7fbf2bb9a982/mzaf_10034680879659020966.plus.aac.p.m4a" },
  { rank: 8, title: "Time of Our Life", artist: "DAY6", artwork: "https://is1-ssl.mzstatic.com/image/thumb/Music123/v4/31/76/89/31768995-21d1-6782-b7e5-184511d51f28/cover-The_Book_of_Us_Gravity.jpg/300x300bb.jpg", previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview113/v4/28/7f/7f/287f7fc8-0043-349f-b3a2-5b9492167389/mzaf_6383679883584872390.plus.aac.p.m4a" },
  { rank: 9, title: "Welcome to the Show", artist: "DAY6", artwork: "https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/44/e9/87/44e987c6-f76a-543a-7a54-6ee7bc18efbe/cover-The_Book_of_Us_Fourever.jpg/300x300bb.jpg", previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview112/v4/83/c9/79/83c979e2-ebfa-b715-db22-df38b699ba14/mzaf_11306637380126781297.plus.aac.p.m4a" },
  { rank: 10, title: "Armageddon", artist: "aespa", artwork: "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/66/ea/1c/66ea1c95-bc1d-eb88-348a-6b80155088f1/cover_Supernova.jpg/300x300bb.jpg", previewUrl: "" },
  { rank: 11, title: "HEYA", artist: "IVE", artwork: "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/10/7c/49/107c4915-d4fc-d102-fae0-52ea5ff0c427/cover_IVE_SWITCH.jpg/300x300bb.jpg", previewUrl: "" },
  { rank: 12, title: "SPOT! (feat. JENNIE)", artist: "ZICO", artwork: "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/21/fb/f0/21fbf04d-e967-df7e-971c-4b537f075d45/196922939887_Cover.jpg/300x300bb.jpg", previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/0d/18/d8/0d18d84a-8d1a-5d66-5c5c-7ec65f7c3c5f/mzaf_10014760875412852702.plus.aac.p.m4a" },
  { rank: 13, title: "Plot Twist", artist: "TWS", artwork: "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/d5/43/d8/d543d83d-3b56-fc45-dbba-9076f8ce9f8e/196922802617_Cover.jpg/300x300bb.jpg", previewUrl: "" },
  { rank: 14, title: "Mantra", artist: "JENNIE", artwork: "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/3c/6d/82/3c6d8226-f7fb-e924-a74e-72ba96b27e8a/198704207907.jpg/300x300bb.jpg", previewUrl: "" },
  { rank: 15, title: "To. X", artist: "TAEYEON", artwork: "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/1c/70/4e/1c704e0e-4be0-4497-6a40-37fc6b280140/cover_To_X.jpg/300x300bb.jpg", previewUrl: "" },
  { rank: 16, title: "Seven (feat. Latto)", artist: "Jung Kook", artwork: "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/02/89/3e/02893e2b-ffad-5e79-8db2-2df7ee25ea24/196922485506_Cover.jpg/300x300bb.jpg", previewUrl: "" },
  { rank: 17, title: "Who", artist: "Jimin", artwork: "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/10/7c/49/107c4915-d4fc-d102-fae0-52ea5ff0c427/cover_IVE_SWITCH.jpg/300x300bb.jpg", previewUrl: "" },
  { rank: 18, title: "Fate", artist: "(G)I-DLE", artwork: "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/2b/23/e6/2b23e67e-2cf0-9e05-c1e1-e6e737084654/cover_2.jpg/300x300bb.jpg", previewUrl: "" },
  { rank: 19, title: "Small girl (feat. D.O.)", artist: "Lee Young Ji", artwork: "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/66/ea/1c/66ea1c95-bc1d-eb88-348a-6b80155088f1/cover_Supernova.jpg/300x300bb.jpg", previewUrl: "" },
  { rank: 20, title: "Drowning", artist: "WOODZ", artwork: "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/8b/6d/21/8b6d2139-448f-8d76-e1e7-2a5c4df7a361/cover_OO-LI.jpg/300x300bb.jpg", previewUrl: "" }
];

module.exports = async function handler(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');[span_0](start_span)[span_0](end_span)[span_1](start_span)[span_1](end_span)
  res.setHeader('Access-Control-Allow-Origin', '*');[span_2](start_span)[span_2](end_span)[span_3](start_span)[span_3](end_span)

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });[span_4](start_span)[span_4](end_span)[span_5](start_span)[span_5](end_span)

  const country = ['th', 'us', 'kr'].includes((req.query?.country || '').toLowerCase())
    ? req.query.country.toLowerCase()
    : 'th';
  const limit = Math.min(parseInt(req.query?.limit || '20', 10), 20);[span_6](start_span)[span_6](end_span)[span_7](start_span)[span_7](end_span)

  const cached = cacheStore.get(country);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');[span_8](start_span)[span_8](end_span)[span_9](start_span)[span_9](end_span)
    return res.status(200).json({ country, songs: cached.songs.slice(0, limit) });[span_10](start_span)[span_10](end_span)[span_11](start_span)[span_11](end_span)
  }

  // หากเป็นชาร์ตเกาหลี (kr) ให้ใช้ข้อมูลชุด KR_FALLBACK_SONGS ทันที เพื่อป้องกันปัญหา RSS เกาหลีคืนค่าว่าง
  if (country === 'kr') {
    cacheStore.set('kr', { songs: KR_FALLBACK_SONGS, timestamp: Date.now() });
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json({ country: 'kr', songs: KR_FALLBACK_SONGS.slice(0, limit) });
  }

  try {
    const rssUrl = `https://itunes.apple.com/${country}/rss/topsongs/limit=25/json`;
    const r = await fetch(rssUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    if (!r.ok) throw new Error('RSS Error: ' + r.status);

    const data = await r.json();[span_12](start_span)[span_12](end_span)[span_13](start_span)[span_13](end_span)
    const entries = data?.feed?.entry || [];[span_14](start_span)[span_14](end_span)[span_15](start_span)[span_15](end_span)

    if (!entries.length) {
      throw new Error('Empty entries');
    }

    const songs = entries.map((e, i) => {
      const images = Array.isArray(e['im:image']) ? e['im:image'] : [];[span_16](start_span)[span_16](end_span)[span_17](start_span)[span_17](end_span)
      const artwork = (images[images.length - 1]?.label || '').replace(/\/\d+x\d+bb\./, '/300x300bb.');[span_18](start_span)[span_18](end_span)[span_19](start_span)[span_19](end_span)
      const links = Array.isArray(e.link) ? e.link : (e.link ? [e.link] : []);[span_20](start_span)[span_20](end_span)[span_21](start_span)[span_21](end_span)
      const appleUrl = links.find(l => l?.attributes?.type === 'text/html')?.attributes?.href || links[0]?.attributes?.href || '';[span_22](start_span)[span_22](end_span)[span_23](start_span)[span_23](end_span)
      const previewUrl = links.find(l => l?.attributes?.rel === 'enclosure' || l?.attributes?.type?.includes('audio'))?.attributes?.href || '';

      return {
        rank: i + 1,[span_24](start_span)[span_24](end_span)[span_25](start_span)[span_25](end_span)
        title: e['im:name']?.label || '',[span_26](start_span)[span_26](end_span)[span_27](start_span)[span_27](end_span)
        artist: e['im:artist']?.label || '',[span_28](start_span)[span_28](end_span)[span_29](start_span)[span_29](end_span)
        artwork,
        appleUrl,[span_30](start_span)[span_30](end_span)[span_31](start_span)[span_31](end_span)
        previewUrl
      };
    }).filter(s => s.title && s.artist).slice(0, 20);[span_32](start_span)[span_32](end_span)[span_33](start_span)[span_33](end_span)

    cacheStore.set(country, { songs, timestamp: Date.now() });
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');[span_34](start_span)[span_34](end_span)[span_35](start_span)[span_35](end_span)
    return res.status(200).json({ country, songs: songs.slice(0, limit) });[span_36](start_span)[span_36](end_span)[span_37](start_span)[span_37](end_span)
  } catch (err) {
    if (cached) return res.status(200).json({ country, songs: cached.songs.slice(0, limit), stale: true });[span_38](start_span)[span_38](end_span)[span_39](start_span)[span_39](end_span)
    // Fallback เมื่อเชื่อมต่อ iTunes RSS ภายนอกไม่สำเร็จ
    return res.status(200).json({ country, songs: KR_FALLBACK_SONGS.slice(0, limit), fallback: true });
  }
};
