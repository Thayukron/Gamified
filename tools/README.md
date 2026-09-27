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

## mock-gemini/ — จำลอง Gemini API สำหรับทดสอบโดยไม่ใช้ Key จริง
```powershell
php -S 127.0.0.1:8010 tools/mock-gemini/index.php
# สร้าง backend/config.local.php ชั่วคราว:
#   <?php return ['gemini' => ['base_url' => 'http://127.0.0.1:8010/v1beta']];
```
Key ที่ใช้ได้ต้องขึ้นต้นด้วย `AIzaMOCK` · `AIzaMOCKQUOTA...` = จำลองโควตาหมด (429) · **ลบ config.local.php หลังทดสอบ**
