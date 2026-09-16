# Muzik Match — AI Music Personality & Discovery Engine

เว็บแอปพลิเคชันค้นหาเพลงตามอารมณ์และวิเคราะห์บุคลิกภาพดนตรี เชื่อมต่อ Gemini Flash 2.0, Apple Music iTunes Feed และ Spotify[span_5](start_span)[span_5](end_span)[span_6](start_span)[span_6](end_span)[span_7](start_span)[span_7](end_span)[span_8](start_span)[span_8](end_span)

## Core Features
1. **MatchQuiz:** แบบทดสอบ 5 มิติอารมณ์ (Dark, Chill, Energy, Emotional, Indie) คำนวณแบบ Distance Match กับฐานข้อมูลศิลปิน[span_9](start_span)[span_9](end_span)[span_10](start_span)[span_10](end_span)
2. **AI Vibe Search:** ค้นหาเพลงด้วยข้อความภาษาธรรมชาติ เช่น "นั่งทำงานฝนตกเหงาๆ[span_11](start_span)[span_12](start_span)"[span_11](end_span)[span_12](end_span)
3. **30s Audio Engine:** เครื่องเล่นตัวอย่างเสียง 30 วินาทีจาก Apple Music พร้อมแถบ Mini-Player ลอยตัว
4. **9:16 Story Card Generator:** เรนเดอร์การ์ดผลลัพธ์ลง Instagram Story / TikTok อัตโนมัติด้วย HTML5 Canvas
5. **Multi-Region Charts:** ติดตามชาร์ตเพลงฮิต Top 20 แยกตามประเทศ (ไทย, สากล, เกาหลี) พร้อม MV[span_13](start_span)[span_13](end_span)[span_14](start_span)[span_14](end_span)[span_15](start_span)[span_15](end_span)[span_16](start_span)[span_16](end_span)
6. **Shuffle Playlist & Favorites:** สุ่มเพลย์ลิสต์และบันทึกเพลงโปรดลงในเครื่อง (Offline PWA)[span_17](start_span)[span_17](end_span)[span_18](start_span)[span_18](end_span)[span_19](start_span)[span_19](end_span)[span_20](start_span)[span_20](end_span)

## Environment Variables (Vercel)[span_21](start_span)[span_21](end_span)[span_22](start_span)[span_22](end_span)
ตั้งค่าใน Vercel Project Settings > Environment Variables:
```env
GEMINI_API_KEY=your_gemini_api_key_here
ALLOWED_ORIGINS=[https://your-domain.com](https://your-domain.com)
