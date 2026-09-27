# ชุด Prompt สร้างภาพตัวละคร/ฉากด้วย Gemini

ภาพที่ Claude วาดได้เป็น SVG (วาดด้วยโค้ด) จึงไม่ละเอียดเท่าภาพวาดดิจิทัลจาก AI สร้างภาพ
ใช้ prompt ในไฟล์นี้สร้างภาพใน Gemini แล้ววางไฟล์ตามชื่อที่กำหนด → บอก Claude ให้ผูกเข้ากับเกม (ระบบรองรับไว้แล้ว)

## ข้อกำหนดไฟล์
| ประเภท | ขนาด/สัดส่วน | พื้นหลัง | วางที่ | ชื่อไฟล์ |
|---|---|---|---|---|
| ตัวละคร | แนวตั้ง **9:16** (เช่น 1080×1920) ครึ่งตัว หัวอยู่ช่วงบน 1/3 | **โปร่งใส (PNG)** หรือ **สีเขียวล้วน #00FF00** (Claude ตัดพื้นหลังให้ได้) | `frontend/public/characters/` | `{id}-{สีหน้า}.png` เช่น `mira-happy.png` |
| ฉาก | แนวนอน **16:9** (1920×1080) จุดสำคัญอยู่กลางภาพ (มือถือจะครอปกลาง) | ไม่มีตัวคนในฉาก | `frontend/public/backgrounds/` | `{key}.jpg` เช่น `library.jpg` |

สีหน้า 5 แบบ: `neutral` (ปกติ), `happy` (ยิ้ม), `surprised` (ตกใจ), `sad` (เศร้า), `determined` (มุ่งมั่น)
ถ้าทำได้ไม่ครบ 5 สีหน้า อย่างน้อยทำ `neutral` 1 ภาพ (ตั้งชื่อ `{id}.png`)

## เคล็ดลับให้ได้ตัวละครหน้าตาเดิมทุกภาพ
1. สร้างภาพ `neutral` ก่อน แล้วในแชทเดิมสั่งต่อว่า *"ตัวละครเดิม ท่าเดิม เปลี่ยนเป็นสีหน้า ..."*
2. ใส่ **Style prompt** เดียวกันทุกภาพ

### Style prompt (ใส่ท้ายทุก prompt ตัวละคร)
```
Semi-realistic anime visual novel character sprite, half body from waist up, facing the viewer, standing pose,
digital painting, soft cinematic rim lighting, detailed eyes and hair, clean line art,
fantasy magic academy setting, full character centered, plain solid #00FF00 green background, no text, 9:16 vertical.
```

## ตัวละคร
| id | คำอธิบายสำหรับ prompt |
|---|---|
| `mira` | Mira, a cheerful 16-year-old apprentice mage girl, long straight pink hair with bangs, violet eyes, wearing a purple mage robe with a high gold-trimmed collar and a small gold brooch |
| `kael` | Kael, a proud 17-year-old top-ranked student mage boy, short black hair under a deep red hooded cloak with gold trim, sharp red eyes, confident smirk |
| `nyx` | Nyx, a playful cat-girl night-market merchant, black bob hair with black cat ears (pink inner ear), golden cat-like eyes, teal merchant robe with gold trim, holding a small lantern |
| `pim` | Pim, a shy 11-year-old street kid, messy brown hair under a worn grey hooded cloak, green eyes, thin and small, slightly dirty face |
| `orin` | Master Orin, a kind elderly astronomer wizard, long white hair and long white beard, round gold glasses, tall navy blue pointed wizard hat with a star, navy blue robe |
| `lumin` | Lumin, a small glowing golden spirit owl with big amber eyes, fluffy cream belly, ear tufts, soft magical aura, cute but majestic (full body, floating) |
| `golem` | A friendly ancient stone golem, blue-grey stone blocks with moss, glowing cyan eyes and a glowing cyan crystal rune on its chest, gentle giant (upper body) |

สีหน้าต่อท้าย prompt เช่น:
- neutral: `calm neutral expression`
- happy: `big happy smile, eyes closed in joy`
- surprised: `surprised, wide eyes, mouth open`
- sad: `sad worried expression, eyebrows raised in the middle, small tear`
- determined: `determined serious expression, furrowed brows, confident`

ตัวอย่าง prompt เต็ม:
```
Mira, a cheerful 16-year-old apprentice mage girl, long straight pink hair with bangs, violet eyes,
wearing a purple mage robe with a high gold-trimmed collar and a small gold brooch, big happy smile, eyes closed in joy.
Semi-realistic anime visual novel character sprite, half body from waist up, ... (style prompt)
```

## ตัวละครของผู้เล่น (ให้นักเรียนเลือกตอนสร้างตัวละคร) — 6 แบบ
ชื่อไฟล์ `hero-{m|f}{1-3}.jpg` · **สีหน้าเดียว** (ผู้ใช้เลือกใช้แบบนี้) · ภาพเต็มตัวได้
ใช้ **Style prompt ตัวละคร** ด้านบนต่อท้ายเหมือนเดิม (พื้นเขียว 9:16 ครึ่งตัว)
ระบบจะแสดงเฉพาะแบบที่มีภาพแล้ว — ทำทีละตัวได้

| id | ชื่อในเกม | คำอธิบายสำหรับ prompt |
|---|---|---|
| `hero-m1` | นักผจญภัยผู้กล้า | a brave 17-year-old Thai boy apprentice adventurer, short spiky black hair, warm tan skin, dark brown eyes, navy blue apprentice mage robe with gold trim over a white shirt, a brown leather belt with pouches, friendly confident smile |
| `hero-m2` | นักเดินทางไร้พรมแดน | a cheerful 17-year-old Southeast Asian boy traveler, messy dark brown hair, light brown skin, reddish-brown leather travel coat over a cream apprentice robe, a satchel strap across the chest, a small compass pendant |
| `hero-m3` | นักปราชญ์รุ่นเยาว์ | a calm 17-year-old East Asian boy scholar, neat black hair, round thin glasses, fair skin, forest green scholar robe with gold embroidery, holding an old leather book |
| `hero-f1` | นักดาบเวทผู้มุ่งมั่น | a determined 17-year-old Thai girl spell-knight apprentice, long black hair in a high ponytail, tan skin, violet eyes, deep purple and silver light armor-robe, a short rune sword at her hip |
| `hero-f2` | นักประดิษฐ์ร่าเริง | a cheerful 16-year-old girl inventor apprentice, short dark brown bob hair with a gold hair clip, fair skin, amber eyes, orange and teal robe with rolled sleeves, brass goggles on her head, a small wrench in a belt |
| `hero-f3` | ผู้เยียวยาใจดี | a gentle 17-year-old Southeast Asian girl healer apprentice, long wavy dark hair in a side braid with small white flowers, light brown skin, soft brown eyes, white and sky blue healer robe with gold trim, a glowing herb pouch |

ตัวอย่าง prompt:
```
A brave 17-year-old Thai boy apprentice adventurer, short spiky black hair, warm tan skin, dark brown eyes,
navy blue apprentice mage robe with gold trim over a white shirt, a brown leather belt with pouches, friendly confident smile.
Semi-realistic anime visual novel character sprite, half body from waist up, ... (style prompt)
```
วางไฟล์ที่ `art-source/characters/` แล้วบอก Claude ให้รัน `tools/process-art.js` (หรือวางใน `frontend/public/characters/` เป็น .webp เอง)

## ฉาก (Background)
Style prompt ฉาก:
```
Semi-realistic anime background art, visual novel background, digital painting, cinematic lighting,
highly detailed, no people, no characters, no text, 16:9 wide.
```
| key | คำอธิบาย |
|---|---|
| `night` | a student's bedroom at midnight, big round window with a full moon, a glowing mysterious black letter with gold seal on the desk, dark blue and purple tones |
| `gate` | a giant ancient stone arch gate in a dark misty forest at midnight, glowing magic runes carved on the gate, purple light behind it |
| `hall` | grand hall of a magic academy, tall stone pillars, golden dust floating in the air, three mysterious doors |
| `library` | enormous magical library, endless tall bookshelves, floating candles, warm golden light, spiral stairs |
| `corridor` | long arched stone corridor in a magic academy, glowing rune lamps, perspective toward a bright doorway |
| `courtyard` | academy courtyard under a huge moon at night, trees, stone fountain, blue moonlight |
| `crystal` | circular crystal chamber, a giant floating violet crystal in the center, magic circle on the floor, purple glow |
| `market` | fantasy night market, hundreds of floating orange paper lanterns, wooden stalls with magical goods, festive |
| `alley` | narrow cobblestone alley at night in a fantasy town, glowing golden footprints on the ground, warm windows |
| `sky` | mountain top at night, sky full of stars and a shooting star, an ancient observatory silhouette |
| `observatory` | inside an ancient observatory dome, giant brass telescope, star charts, open dome showing the night sky |

### ฉากวิทยาลัย/อาชีพ (สำหรับเควสต์ธีมผสมที่จะทำต่อ — อ้างอิงคลัง 12 ฉากใน Gemini)
`campus` (ลานวิทยาลัย), `college_library` (ห้องสมุดสมัยใหม่), `homeroom` (ห้องโฮมรูม/กิจกรรม), `space_bridge` (สะพานยานอวกาศ),
`rainforest` (ป่าดิบชื้น), `hacker_lab` (แล็บคอมพิวเตอร์ใต้ดิน), `garage` (อู่ซ่อมรถ), `design_studio` (สตูดิโอดิจิทัล),
`boardroom` (ห้องประชุมบริษัท), `obstacle` (ด่านอุปสรรค), `community` (งานจิตอาสา), `pitch_stage` (เวทีนำเสนอธุรกิจ)
