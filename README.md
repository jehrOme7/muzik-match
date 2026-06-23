# Muzik Match 🎵

เว็บแอปหาเพลงและศิลปินที่ใกล้เคียงด้วย AI (Gemini)

ผู้ใช้แค่พิมพ์ชื่อเพลงหรือศิลปินที่ชอบ แล้วระบบจะแนะนำเพลงและวงที่ใกล้เคียงให้ทันที — ไม่ต้องใส่ API key เอง

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

เอา Gemini API key ฟรีได้ที่ https://aistudio.google.com/apikey
by jehrOme7
