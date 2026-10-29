# tools

## process-art.js — แปลงภาพจาก Gemini ให้พร้อมใช้ในเกม
- ตัวละคร (`art-source/characters/*.jpg` พื้นหลังเขียว) → ตัดพื้นหลัง (chroma key + ลบสีเขียวที่ขอบ) → `frontend/public/characters/*.webp` สูง 1254px
- ฉาก (`art-source/backgrounds/*.jpg`) → 1920×1080 → `frontend/public/backgrounds/*.webp`
- ไฟล์ชื่อ `golem-neural` จะถูกแก้เป็น `golem-neutral` อัตโนมัติ · ภาพที่ขึ้นต้น `golem` จะไม่ลบสีเขียวภายใน (ตะไคร่)

```powershell
cd tools; npm i sharp   # ครั้งแรก
node process-art.js ../art-source ../frontend/public
```
ไฟล์ต้นฉบับเก็บที่ `art-source/` (อยู่ใน .gitignore เพราะไฟล์ใหญ่ ~110MB)
หลังเพิ่มโฟลเดอร์ใหม่ใน `frontend/public/` ต้อง restart `nuxt dev`
