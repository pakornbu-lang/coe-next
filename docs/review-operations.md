# งานกรรมการและสัมภาษณ์

## หน้าที่เพิ่ม
- /staff/assignments: กรองงาน/กรรมการ งานเกินกำหนด จำนวนค้าง เปลี่ยนกำหนดส่ง ถอนและเปลี่ยนกรรมการพร้อมเหตุผล
- /staff/evaluations: คะแนนรายกรรมการ/รายเกณฑ์ เฉลี่ยเฉพาะผลส่งแล้วและไม่ถอนงาน
- /staff/interviews: กรองวัน/ทุน ตั้งเวลาเริ่มและสิ้นสุด กรรมการ สถานที่ ลิงก์ สถานะเข้าร่วม ผลสัมภาษณ์
- /committee/interviews: นัดของกรรมการที่เข้าสู่ระบบ
- /committee: แสดงกำหนดส่งงาน

หนึ่งใบสมัครยังมีหนึ่งนัดที่แก้ไขได้ ไม่รองรับหลายรอบในรุ่นนี้ ผลสัมภาษณ์ใน application_interviews อ่านได้ตาม RLS ของตาราง รวมถึงเจ้าของใบสมัคร จึงไม่ควรใส่บันทึกลับภายใน

## ติดตั้ง
ต้องติดตั้ง 20260923090000_review_operations.sql ก่อนเปิดโค้ดรุ่นนี้:
ใช้ Supabase CLI ที่เชื่อมกับโปรเจกต์เป้าหมายแล้ว: npx supabase db push
อย่ารันไฟล์ทดสอบ fixtures บนฐานข้อมูลจริง

## ตรวจสอบ
supabase/tests/review_operations.sql ใช้ฐานข้อมูลทดสอบแยกเท่านั้น:
สร้าง staff/committee/student จำลองใน transaction และ rollback
ทดสอบมอบหมาย กำหนดส่ง เวอร์ชันเก่า สิทธิ์ คะแนนส่งแล้วแก้ไม่ได้
ทดสอบกรรมการ/สถานที่เวลาซ้อน นัดต่อกัน และแจ้งเตือนไม่ซ้ำ

ชุด migrations ทั้งหมดและ SQL test นี้ผ่าน PGlite ในฐานข้อมูลชั่วคราว
ยังต้องทดสอบผ่าน UI ด้วยบัญชีแต่ละบทบาทหลังติดตั้ง migration

## อีเมลและแจ้งเตือน
ใช้ Apps Script จาก docs/apps-script-notifier.gs โดยกำหนดค่าบนเครื่องและโฮสต์:
NOTIFICATION_APPS_SCRIPT_URL (Web app /exec)
NOTIFICATION_APPS_SCRIPT_SECRET (ตรงกับ Script properties)
SUPABASE_SECRET_KEY (server only)
NEXT_PUBLIC_SITE_URL (URL ที่ผู้รับเปิดได้)
NOTIFICATION_DISPATCH_SECRET หรือ CRON_SECRET สำหรับ endpoint scheduler

/api/notifications/dispatch ตรวจ Bearer secret ก่อนสร้างแจ้งเตือนที่ใกล้ถึงกำหนด 24 ชั่วโมง แล้วส่ง outbox
vercel.json ตั้งเรียกทุก 5 นาทีไว้แล้ว แต่ scheduler ต้องรองรับความถี่นี้
บน localhost ไม่มี scheduler ทำงานอัตโนมัติ ต้องเรียก endpoint โดย scheduler ภายนอก
เมื่อเปลี่ยนกำหนด/นัด ระบบสร้างแจ้งเตือนในเว็บและคิวอีเมล แต่ไม่รับประกันถึง Inbox
ห้ามเก็บ secret ใน Git หรือใช้ NEXT_PUBLIC_ กับ secret

## ข้อจำกัด
- คำขอหนึ่งครั้งอ่านรายการตามขีดจำกัด Data API ของ Supabase; โปรเจกต์ขนาดใหญ่ควรเพิ่ม pagination ฝั่ง server
- ตรวจห้องซ้ำจากชื่อหลังตัดช่องว่างและแปลงตัวพิมพ์เล็ก ควรตั้งชื่อห้องให้เหมือนกัน
- การเตือนใกล้กำหนดใช้ cron หากระบบหยุดในช่วง 24 ชั่วโมงนั้นอาจไม่มีการเตือน
