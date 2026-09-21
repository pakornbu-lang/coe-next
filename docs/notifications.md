# การแจ้งเตือนผ่าน Google Apps Script

ระบบสร้างการแจ้งเตือนในเว็บและใส่อีเมลลงคิว Supabase พร้อมกัน เมื่อมีนักศึกษาส่งใบสมัคร, เจ้าหน้าที่ขอเอกสารเพิ่ม, มอบหมายกรรมการ, กรรมการส่งผล, ตัดสินผล หรือบันทึกการจ่ายทุน อีเมลใช้เทมเพลตสีเขียวอ่อนพร้อมตราระบบ กล่องรายละเอียด และปุ่มเปิดรายการจากอีเมลโดยตรง

## 1. สร้าง Google Apps Script

1. ลงชื่อเข้าใช้ Google ด้วยบัญชีที่จะเป็นผู้ส่ง เช่น `zreox9x00@gmail.com`
2. เปิด [script.google.com](https://script.google.com) แล้วเลือก **New project**
3. ลบเนื้อหาใน `Code.gs` แล้ววางโค้ดทั้งหมดจาก `docs/apps-script-notifier.gs`
4. เลือก **Project Settings** → **Script properties** → **Add script property**
5. ตั้งชื่อ `NOTIFICATION_APPS_SCRIPT_SECRET` และวางรหัสสุ่มยาวอย่างน้อย 32 ตัวอักษร
6. กด **Deploy** → **New deployment** → เลือก **Web app**
7. ตั้ง **Execute as: Me** และ **Who has access: Anyone** เพื่อให้เซิร์ฟเวอร์เว็บไซต์เรียกได้ โดย secret ในขั้นที่ 5 จะป้องกันคำขอจากภายนอก
8. กด **Deploy** และอนุญาตสิทธิ์ MailApp เมื่อ Google ถาม
9. คัดลอก URL ที่ลงท้ายด้วย `/exec` เท่านั้น ห้ามใช้ URL ที่ลงท้ายด้วย `/dev`

## 2. ตั้งค่าบนเครื่อง deploy

เพิ่มตัวแปรต่อไปนี้ใน Vercel หรือผู้ให้บริการที่ deploy เว็บไซต์ ห้าม commit คีย์เหล่านี้ลง Git และห้ามตั้งชื่อเป็น `NEXT_PUBLIC_`:

```text
SUPABASE_SECRET_KEY=sb_secret_... (จาก Supabase → Settings → API Keys → Secret key)
NOTIFICATION_APPS_SCRIPT_URL=https://script.google.com/macros/s/.../exec
NOTIFICATION_APPS_SCRIPT_SECRET=ค่าเดียวกับ Script property
NOTIFICATION_DISPATCH_SECRET=ค่าสุ่มอีกค่า สำหรับ scheduler ทั่วไป
CRON_SECRET=ค่าสุ่มอีกค่า สำหรับ Vercel Cron
NEXT_PUBLIC_SITE_URL=https://โดเมนจริงของระบบ
```

หลังแก้ environment variables ต้อง deploy ใหม่เสมอ ระบบจะเลือก Google Apps Script เป็นผู้ส่งอีเมลทันทีเมื่อพบ URL และ secret ครบ

## 3. ตั้ง scheduler สำหรับส่งซ้ำ

ระบบพยายามส่งทันทีหลัง workflow สำเร็จอยู่แล้ว Scheduler ใช้ส่งซ้ำเฉพาะรายการที่ล้มเหลว

- Scheduler ทั่วไป: เรียก `POST /api/notifications/dispatch` ทุก 5 นาที พร้อม header `Authorization: Bearer <NOTIFICATION_DISPATCH_SECRET>`
- Vercel: กำหนด `CRON_SECRET` แล้วสร้าง `vercel.json` ที่ root ของโปรเจกต์:

```json
{
  "crons": [
    { "path": "/api/notifications/dispatch", "schedule": "*/5 * * * *" }
  ]
}
```

Vercel Hobby เรียก Cron ได้สูงสุดวันละครั้ง หากต้องการทุก 5 นาทีให้ใช้แพลนที่รองรับหรือ scheduler ภายนอก

## 4. ทดสอบและตรวจผล

1. ใช้บัญชีนักศึกษาทดสอบสมัครทุน แล้วให้เจ้าหน้าที่กดขอแก้ไขเอกสาร
2. ตรวจ Inbox และ Spam ของนักศึกษา อีเมลควรแสดงชื่อผู้ส่ง `ระบบติดตามทุนการศึกษา`
3. ใน Supabase SQL Editor ตรวจสถานะ:

```sql
select to_email, subject, status, last_error, sent_at
from public.notification_email_outbox
order by created_at desc
limit 20;
```

สถานะ `sent` หมายถึง Apps Script ยืนยันการส่งแล้ว ถ้าเป็น `failed` ให้ดู `last_error` และ Apps Script → **Executions**

อีเมลสมัครสมาชิกและเปลี่ยนอีเมลของ Supabase เป็นคนละระบบกับแจ้งเตือน workflow และยังต้องตั้ง Custom SMTP ใน Supabase Authentication หากต้องการส่งถึงทุกคนจริง
