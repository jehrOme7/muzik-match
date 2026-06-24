# Muzik Match 🎵

Muzik Personality Matching เพลงที่ใช่ เริ่มจากความรู้สึกของคุณ ระบบสุ่ม Playlist เพลงที่ใช่ผ่านตัวตนของคุณ วิเคราะห์ และ เลือก Playlist ศิลปินที่ใกล้เคียงกับ Personality ของคุณ ด้วย AI (Gemini)

แค่ตอบ 5 คำถาม เราจะวิเคราะห์บุคลิกภาพดนตรีของคุณ แล้วจับคู่ศิลปินและ playlist ที่ match ที่สุดให้ทันที — ไม่ต้องเสียเวลาหาเอง ✨

## โครงสร้างไฟล์

```
muzik-match/
├── api/
│   └── search.js       ← backend (เก็บ API key ลับ)
├── public/
│   └── index.html      ← หน้าเว็บที่ผู้ใช้เห็น
├── package.json
└── README.md
```

## วิธี deploy บน Vercel

1. อัปโหลดโฟลเดอร์นี้ขึ้น GitHub
2. เข้า vercel.com → Add New → Project → เลือก repo นี้
3. ตั้งค่า Environment Variable:
   - Name: `GEMINI_API_KEY`
   - Value: (Gemini API key ของคุณ)
4. กด Deploy

Created by jehrOme7
