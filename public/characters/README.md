# ภาพตัวละคร (ไม่บังคับ)

วางไฟล์ภาพตัวละคร (PNG พื้นหลังโปร่งใส แนะนำขนาดสัดส่วน 300×530, ครึ่งตัว) ไว้ในโฟลเดอร์นี้
แล้วเพิ่มในนิยามตัวละครของไฟล์เนื้อเรื่อง JSON เพื่อแทนภาพ SVG ที่วาดด้วยโค้ด:

```json
"mira": { "name": "มิร่า", "kind": "mage", "image": "/characters/mira.png" }
```

หรือแยกภาพตามสีหน้า (สีหน้าที่ไม่มีภาพจะใช้ `image` แทน):

```json
"images": { "happy": "/characters/mira-happy.png", "sad": "/characters/mira-sad.png" }
```

สีหน้าที่รองรับ: neutral, happy, surprised, sad, determined
