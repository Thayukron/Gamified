# 📘 คู่มือการรันระบบ ARCANA PROFILE

> เฟส 5 (2026-10-29): API ย้ายเป็น Nitro ครบ 86/86 แล้ว ทดลองแผนการสอน/ใบงาน/เล่มรายวิชาและการตั้งค่า AI ที่ port 3100 ด้วย teacher-demo/teacher1234; ครูต้องกรอก Gemini key ของตนเองก่อนสร้างด้วย AI ดู [รายละเอียดและข้อจำกัดการตรวจรับ](docs/migration/phase5-ai-plans-jobs.md) การทดสอบ provider รอบนี้ใช้ mock ยังรอ key จริง

> เฟส 4 (2026-10-29): ครู/แอดมินส่วนจัดการข้อมูล dashboard ไกด์ จัดกลุ่ม และรายงานใช้ Nitro แล้ว รวม 56/86 API ทดลองที่ port 3100 ด้วย `teacher-demo/teacher1234` ดู [คู่มือเฟส 4](docs/migration/phase4-staff.md) AI/แผนการสอนยังรอเฟส 5

> เฟส 3 (2026-10-29): เกม/ผลประเมินฝั่งนักศึกษาใช้ Nitro แล้ว รัน Nuxt โดยตรง เปิด `/login` ที่ port 3100 ใช้ `student-demo/student1234` เพื่อตรวจรับ รายละเอียด [เฟส 3](docs/migration/phase3-game.md) ส่วนครู/แอดมิน/AI ยังอยู่ระหว่างย้าย

> อัปเดต 2026-10-29: งานย้าย Nuxt เฟส 2 ใช้ MariaDB service ในเครื่อง port 3306 และฐาน gamified ใหม่ตามผู้ใช้ รัน API โดยไม่ใช้ Docker: เข้า `frontend` แล้ว `npm run dev -- --dotenv ../.env` เปิด `http://localhost:3100/api/health` รองรับเฉพาะ auth/account ที่ย้ายแล้ว ดู [วิธีรันและขอบเขตเฟส 2](docs/migration/phase2-foundation.md) คำสั่ง Docker/start-dev เดิมด้านล่างเป็นของระบบ PHP เดิม

คู่มือนี้สำหรับเปิด/ปิดระบบบนเครื่องนี้ด้วยตัวเอง และเปิดลิงก์ให้นักเรียน/ครูเข้าจากภายนอกผ่าน Cloudflare Tunnel
(รายละเอียดการติดตั้งบนเซิร์ฟเวอร์ใหม่ดูที่ [DEPLOY.md](DEPLOY.md))

> ทุกคำสั่งในคู่มือนี้พิมพ์ใน **PowerShell** หรือ **Terminal ของ VS Code**
> ที่โฟลเดอร์โปรเจกต์ `D:\เอกสารเทอม 1 ปี 69\VibeCode69\Gamified`
>
> ```powershell
> cd "D:\เอกสารเทอม 1 ปี 69\VibeCode69\Gamified"
> ```

---

## 1. ภาพรวม: ระบบประกอบด้วยอะไร 🧩

ระบบทั้งหมดรันใน **Docker** 3 ส่วน (เปิด/ปิดพร้อมกันด้วยคำสั่งเดียว)

| ส่วน | หน้าที่ | ที่อยู่ |
|---|---|---|
| `web` | หน้าเว็บ (Nginx) | http://localhost:8090 |
| `api` | ระบบหลังบ้าน (PHP) | ผ่าน http://localhost:8090/api |
| `db` | ฐานข้อมูล MariaDB (**ข้อมูลจริงชุดเดียวของระบบ**) | `127.0.0.1:3320` (เฉพาะเครื่องนี้) |

- ค่ารหัสผ่านฐานข้อมูลและพอร์ตอยู่ในไฟล์ `.env` (ห้ามส่งไฟล์นี้ให้ใคร / ไม่ขึ้น GitHub)
- ข้อมูลอยู่ใน Docker volume — ปิดเครื่อง/ปิด Docker ข้อมูลไม่หาย

---

## 2. เปิดระบบ ▶️

1. เปิดโปรแกรม **Docker Desktop** แล้วรอจนมุมล่างซ้ายขึ้นว่า *Engine running* (สีเขียว)
2. เปิด PowerShell ที่โฟลเดอร์โปรเจกต์ แล้วพิมพ์

   ```powershell
   docker compose up -d
   ```

3. ตรวจว่าทำงานครบ 3 ตัว (คอลัมน์ STATUS เป็น `Up`)

   ```powershell
   docker compose ps
   ```

4. เปิดเบราว์เซอร์ไปที่ **http://localhost:8090**

> 💡 ตั้งค่า Docker Desktop → Settings → General → ✅ *Start Docker Desktop when you sign in*
> แล้วระบบจะเปิดเองทุกครั้งที่เปิดเครื่อง (container ตั้ง `restart: unless-stopped` ไว้แล้ว)

## 3. ปิดระบบ ⏹️

```powershell
docker compose stop
```

เปิดใหม่ด้วย `docker compose up -d` เหมือนเดิม

> ⚠️ **ห้ามใช้** `docker compose down -v` — ตัว `-v` จะ **ลบฐานข้อมูลทั้งหมด**
> (`docker compose down` แบบไม่มี `-v` ยังปลอดภัย ข้อมูลไม่หาย)

## 4. อัปเดตเมื่อโค้ดมีการแก้ไข 🔄

```powershell
git pull
docker compose up -d --build
```

ระบบจะอัปเกรดโครงสร้างฐานข้อมูลให้เองโดยไม่ลบข้อมูล (ใช้เวลา 1–3 นาที)

---

## 5. เปิดลิงก์ให้คนภายนอกเข้า (Cloudflare Tunnel) 🌐

ใช้เมื่ออยากให้นักเรียน/ครูเข้าระบบจากมือถือหรือเครื่องอื่นผ่านอินเทอร์เน็ต โดยไม่ต้องตั้งค่าเราเตอร์
**ต้องเปิดระบบ (ข้อ 2) ก่อนเสมอ**

### วิธีที่ 1: Quick Tunnel — ง่ายที่สุด (แนะนำสำหรับทดสอบ/ใช้ในคาบ)

เครื่องนี้ติดตั้ง `cloudflared` ไว้แล้ว เปิด PowerShell **หน้าต่างใหม่** แล้วพิมพ์

```powershell
cloudflared tunnel --url http://localhost:8090
```

รอประมาณ 10–20 วินาที จะมีกล่องข้อความแบบนี้

```
Your quick Tunnel has been created! Visit it at (it may take some time to be reachable):
https://xxxx-xxxx-xxxx.trycloudflare.com
```

- ลิงก์ `https://….trycloudflare.com` นี้คือลิงก์ที่ส่งให้นักเรียน (เป็น HTTPS ให้อัตโนมัติ)
- ถ้าเปิดลิงก์ทันทีแล้วยังไม่ขึ้น ให้รอ 30 วินาที–1 นาทีแล้วลองใหม่
- **ต้องเปิดหน้าต่างนี้ค้างไว้** ตลอดเวลาที่ให้คนอื่นใช้งาน
- **ปิด Tunnel:** กด `Ctrl + C` ในหน้าต่างนั้น (หรือปิดหน้าต่าง)

> ⚠️ ทุกครั้งที่เปิดใหม่จะได้ **ลิงก์ใหม่** (ลิงก์เก่าใช้ไม่ได้) และลิงก์อาจหลุดถ้าเปลี่ยน Wi-Fi/เครื่อง Sleep
> → เปิดใหม่แล้วส่งลิงก์ใหม่ให้นักเรียน

#### ทางเลือก: รัน Quick Tunnel เบื้องหลังด้วย Docker (ปิดหน้าต่างได้)

```powershell
# เปิด (รันเบื้องหลัง)
docker run -d --name arcana-quick-tunnel cloudflare/cloudflared:latest tunnel --no-autoupdate --url http://host.docker.internal:8090

# ดูลิงก์ (รอ 10–20 วินาทีหลังเปิด)
docker logs arcana-quick-tunnel 2>&1 | Select-String "https://.*trycloudflare.com"

# ปิด
docker rm -f arcana-quick-tunnel
```

ถ้าขึ้นว่าชื่อ `arcana-quick-tunnel` ถูกใช้แล้ว ให้สั่งปิด (`docker rm -f …`) ก่อนแล้วค่อยเปิดใหม่

### วิธีที่ 2: Named Tunnel — ลิงก์ถาวร ใช้โดเมนของตัวเอง

เหมาะกับใช้งานจริงระยะยาว ลิงก์ไม่เปลี่ยน (ต้องมีโดเมนอยู่ใน Cloudflare)

ถ้ามี Tunnel อยู่แล้ว (เช่นของโปรเจกต์ btech-sice) เพิ่มลิงก์ให้ ARCANA ได้เลย:

1. เข้า https://one.dash.cloudflare.com → **Networks → Tunnels** → เลือก Tunnel ที่มีอยู่ → แท็บ **Public Hostname** → **Add a public hostname**
2. กรอก
   - **Subdomain:** เช่น `arcana` (จะได้ `arcana.โดเมนของคุณ`)
   - **Domain:** เลือกโดเมน
   - **Service:** Type `HTTP` · URL `host.docker.internal:8090`
     (ถ้า Tunnel นั้นรันด้วย `cloudflared` บนเครื่องโดยตรง ไม่ใช่ใน Docker ให้ใช้ `localhost:8090`)
3. กด **Save** — ใช้งานได้ภายในไม่กี่วินาที ไม่ต้องรีสตาร์ทอะไร

ตราบใดที่ Tunnel ตัวนั้นทำงานและระบบ ARCANA เปิดอยู่ ลิงก์จะใช้ได้ตลอด

### ✅ เช็กลิสต์ก่อนส่งลิงก์ให้นักเรียน

- [ ] เปลี่ยนรหัสผ่าน `admin` และบัญชีครูตัวอย่าง (`teacher1` ฯลฯ) จากรหัสตัวอย่างแล้ว — เมนู **บัญชีของฉัน**
- [ ] มีบัญชีนักศึกษาแล้ว — แอดมินนำเข้าทั้งวิทยาลัย (`/admin/import` → นักศึกษา) **หรือ** ครูนำเข้าเฉพาะวิชาตนเอง (รายวิชา → รายชื่อ / แก้ไขวิชา → แท็บ “นำเข้าจากไฟล์ Excel/CSV”) · นักศึกษาเข้าครั้งแรกด้วย **รหัสนักศึกษา** เป็นทั้งชื่อผู้ใช้และรหัสผ่าน แล้วระบบบังคับตั้งรหัสใหม่
- [ ] สำรองฐานข้อมูลก่อน (ข้อ 6)
- [ ] ตั้งค่าเครื่องไม่ให้ Sleep ระหว่างใช้งาน (Settings → System → Power)
- [ ] ลองเปิดลิงก์จากมือถือที่ใช้เน็ตมือถือ (ไม่ใช่ Wi-Fi เดียวกัน) ว่าเข้าได้

---

## 5.5 ขึ้นภาคเรียนใหม่ / เลื่อนชั้น / สำเร็จการศึกษา 📅

| งาน | ทำที่ไหน |
|---|---|
| เปลี่ยนภาคเรียนปัจจุบัน | แอดมิน → **ภาพรวมระบบ** → การ์ด “ภาคเรียนปัจจุบัน” (ไม่ต้องแก้ไฟล์ `.env`) |
| เลื่อนชั้นทั้งกลุ่ม (ใช้รายชื่อเดิม) | แอดมิน → **นักศึกษาและกลุ่มเรียน** → “เลื่อนชั้น / เปลี่ยนชื่อกลุ่ม” เช่น ปวส.1/1 → ปวส.2/1 |
| สำเร็จการศึกษา / ออกกลางคัน | แอดมิน → **นักศึกษาและกลุ่มเรียน** → ทั้งกลุ่ม หรือกดชื่อกลุ่มแล้วเลือกรายคน (ข้อมูลไม่ถูกลบ เปลี่ยนกลับได้) |
| สร้างรายวิชาของภาคเรียนใหม่ | ครู → **สร้างรายวิชา** (เลือกภาคเรียน/ปีการศึกษาได้ ค่าเริ่มต้น = ภาคเรียนปัจจุบัน) |
| นำนักเรียนออกจากรายวิชา | ครู → รายวิชา → **รายชื่อ / แก้ไขวิชา** → ติ๊กเลือกแล้ว “นำที่เลือกออก” หรือ “นำออกทั้งกลุ่ม” |

> ผลโปรไฟล์ผู้เรียนใช้ผลล่าสุดต่อข้ามภาคเรียน — เปลี่ยนภาคแล้วแดชบอร์ดไม่หาย ผู้เรียนเล่นเควสต์ซ้ำในภาคใหม่เพื่ออัปเดตได้

## 6. สำรองและกู้คืนข้อมูล 💾

ควรสำรองก่อนอัปเดตระบบ ก่อนนำเข้าข้อมูลชุดใหญ่ และเป็นประจำ (ไฟล์เก็บในโฟลเดอร์ `backups\` ซึ่งไม่ขึ้น GitHub)

```powershell
# สำรอง (ได้ไฟล์ตามวันที่ เช่น backups\arcana-2569-10-20.sql — ปีตามที่ตั้งในเครื่อง)
New-Item -ItemType Directory -Force backups | Out-Null
docker compose exec -T db sh -c 'mariadb-dump -uroot -p"$MARIADB_ROOT_PASSWORD" --single-transaction "$MARIADB_DATABASE"' | Out-File -Encoding utf8 "backups\arcana-$(Get-Date -Format yyyy-MM-dd).sql"
```

```powershell
# กู้คืน (⚠️ เขียนทับข้อมูลปัจจุบันทั้งหมด — แก้ชื่อไฟล์ให้ตรง)
Get-Content -Raw -Encoding utf8 "backups\arcana-2569-10-20.sql" | docker compose exec -T db sh -c 'mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" "$MARIADB_DATABASE"'
```

> 🔑 API Key ของครูถูกเข้ารหัสด้วยไฟล์ `app.key` ในระบบ — ถ้าย้ายไปเครื่องใหม่ต้องย้ายไฟล์นี้ไปด้วย (ดู [DEPLOY.md](DEPLOY.md))

## 7. ดูข้อมูลในฐานข้อมูลโดยตรง 🗄️

ใช้โปรแกรม HeidiSQL / DBeaver / Navicat เชื่อมต่อที่

| ค่า | |
|---|---|
| Host | `127.0.0.1` |
| Port | `3320` |
| User | `arcana` (หรือ `root`) |
| Password | ค่า `DB_PASSWORD` (หรือ `DB_ROOT_PASSWORD`) ในไฟล์ `.env` |
| Database | `gamified` |

> ระบบมีฐานข้อมูล **ชุดเดียว** — พอร์ตอื่น (3306, 3308, 3310) เป็นของโปรแกรม/โปรเจกต์อื่น ไม่ใช่ของ ARCANA

---

## 8. แก้ปัญหาที่พบบ่อย 🛠️

| อาการ | สาเหตุ / วิธีแก้ |
|---|---|
| เปิด http://localhost:8090 ไม่ขึ้น | Docker Desktop ยังไม่เปิด หรือยังไม่ได้ `docker compose up -d` → ตรวจด้วย `docker compose ps` |
| `docker` : The term 'docker' is not recognized | Docker Desktop ยังไม่ได้ติดตั้ง/เปิด หรือเปิด PowerShell ก่อนติดตั้ง → ปิดแล้วเปิด PowerShell ใหม่ |
| ลิงก์ trycloudflare เปิดไม่ได้ / ขึ้น *could not resolve host* | Tunnel หลุด (เปลี่ยนเน็ต/เครื่อง Sleep/ปิดหน้าต่าง) → เปิด Tunnel ใหม่ (ข้อ 5) แล้วส่งลิงก์ใหม่ |
| ลิงก์ Tunnel ขึ้น *Error 502 / 1033* | ระบบ ARCANA ปิดอยู่ → `docker compose up -d` |
| ใส่ API Key Gemini แล้วขึ้น 502 / “เครือข่ายอาจบล็อก” | เครือข่ายสถานศึกษา (UniNet) บล็อก `generativelanguage.googleapis.com` → ให้เครื่องนี้ใช้ฮอตสปอตมือถือ หรือขอผู้ดูแลเครือข่ายเปิดโดเมนนี้ |
| AI ขึ้น “เกินโควตา” / “Google ไม่ว่าง” | รอ 1–2 นาทีแล้วกดใหม่ (โควตาของ Key ครูแต่ละคน) — ไกด์แบบไม่ใช้ AI ใช้ได้ตามปกติ |
| ผู้ดูแลระบบลืมรหัสผ่าน (ไม่มี admin คนอื่นรีเซ็ตให้) | `docker compose exec api php bin/reset-password.php admin` → รหัสผ่านกลายเป็น `admin` แล้วระบบบังคับตั้งใหม่ตอนเข้า |
| พอร์ต 8090 ถูกโปรแกรมอื่นใช้ | แก้ `APP_PORT` ในไฟล์ `.env` เป็นเลขอื่น (เช่น 8091) แล้ว `docker compose up -d` |

## 9. (สำหรับนักพัฒนา) โหมดแก้โค้ด 👩‍💻

ใช้เฉพาะตอนแก้โค้ดแล้วอยากเห็นผลทันทีโดยไม่ build Docker ใหม่ — ใช้ฐานข้อมูลชุดเดียวกับ Docker

```powershell
./start-dev.ps1
```

- หน้าเว็บ: http://localhost:3100 · API: http://127.0.0.1:8100
- แก้เสร็จแล้วต้อง `docker compose up -d --build` เพื่อให้ http://localhost:8090 (และลิงก์ Tunnel) ได้โค้ดใหม่
- ⚠️ ห้ามรัน `php backend/database/migrate.php` — คำสั่งนี้ล้างข้อมูลจริง (ระบบจะปฏิเสธถ้ามีผู้ใช้อยู่แล้ว)

---

## 📌 สรุปคำสั่งที่ใช้บ่อย

| ต้องการ | คำสั่ง |
|---|---|
| เปิดระบบ | `docker compose up -d` |
| ปิดระบบ | `docker compose stop` |
| ดูสถานะ | `docker compose ps` |
| อัปเดตโค้ดใหม่ | `git pull` แล้ว `docker compose up -d --build` |
| เปิดลิงก์ภายนอก | `cloudflared tunnel --url http://localhost:8090` (ปิดด้วย `Ctrl + C`) |
| ดู log เมื่อมีปัญหา | `docker compose logs --tail 50 api` |
| สำรองข้อมูล | ดูข้อ 6 |
