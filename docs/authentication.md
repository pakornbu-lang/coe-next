# บัญชีสมาชิกและ Admin

ระบบใช้ Supabase Auth เก็บรหัสผ่าน และ portal_profiles เก็บชื่อ รหัส อีเมล บทบาท และสถานะ Secret/Service role key ใช้เฉพาะฝั่งเซิร์ฟเวอร์ ไม่ส่งให้เบราว์เซอร์

## เริ่มใช้งาน
1. npm ci
2. คัดลอก .env.example เป็น .env.local และใส่ Supabase URL / Publishable key ของทีม รวมทั้ง SUPABASE_SECRET_KEY และ NOTIFICATION_DISPATCH_SECRET สำหรับการสมัครสมาชิก
3. ตั้ง NEXT_PUBLIC_SITE_URL=http://localhost:3000 (บนโฮสต์จริงใช้ HTTPS URL ของเว็บ)
4. npm run dev แล้วเปิด /login หรือ /register

## สมัครนักศึกษา
/register รับชื่อ รหัสนักศึกษา 8–12 หลัก และอีเมล `@mail.wu.ac.th` เท่านั้น ระบบสร้างบัญชี Student แบบยืนยันอีเมลอัตโนมัติและเข้าสู่ระบบทันทีผ่าน Server Action ที่ตรวจข้อมูลและจำกัดจำนวนคำขอ
Trigger บน auth.users สร้าง portal_profiles ด้วย role=student เสมอ แม้ผู้เรียกปลอม role ใน metadata
ข้อมูลอีเมลเปลี่ยนตาม Auth เท่านั้น ส่วนชื่อ/รหัสแก้ไขจากหน้า Admin พร้อมเหตุผล

การสมัครจากหน้านี้ไม่ส่งลิงก์ยืนยันอีเมล จึงตรวจเพียงรูปแบบโดเมน ไม่ได้พิสูจน์ว่าเป็นเจ้าของอีเมลมหาวิทยาลัยจริง สิทธิ์ที่สร้างใหม่เป็น Student เท่านั้น การยืนยันอีเมลระดับโปรเจกต์ยังเปิดอยู่สำหรับการสมัครช่องทางอื่น

ต้องตั้ง `SUPABASE_SECRET_KEY` และ `NOTIFICATION_DISPATCH_SECRET` บนเซิร์ฟเวอร์เพื่อใช้การสมัครจากหน้าเว็บ ห้ามส่งค่าดังกล่าวไปฝั่งเบราว์เซอร์ การเปลี่ยนอีเมลยังต้องใช้ช่องทางส่งอีเมลยืนยันของ Supabase ส่วนการลืมรหัสผ่านใช้ Apps Script ได้ตาม [คู่มือ](password-reset.md)

## Admin
- /admin: ค้นหา/กรอง/แบ่งหน้าสมาชิก แก้ชื่อและรหัส กำหนดบทบาทและอนุมัติในครั้งเดียว เปิด/ระงับบัญชี
- /admin/reference: เพิ่ม/แก้ไข/ปิดรายการประเภททุน คณะ และสาขาวิชา
- /admin/audit: ผู้ทำรายการ เวลา เหตุผล ค่าก่อนและหลัง พร้อมแบ่งหน้า

Student = student, Officer = staff (ชื่อภายในเดิม), Committee = committee, Admin = admin
เลือก Student / Officer / Committee แล้วกดบันทึกและอนุมัติครั้งเดียว การเปลี่ยน role และ audit เกิดใน transaction เดียว ไม่มีการรออนุมัติรอบสอง บัญชีเดิมของเจ้าหน้าที่/กรรมการยังใช้ได้
การกำหนดบทบาทใหม่แทนที่สิทธิ์เดิมทันทีใน request ถัดไป และล้าง pending_role เดิม (ถ้ามี) การระงับปิดสิทธิ์และยกเลิกคำขอค้าง
Admin ไม่สามารถเปลี่ยนสิทธิ์/ระงับตนเองหรือบัญชี Admin อื่นผ่าน UI/RPC นี้ และไม่สามารถสร้าง Admin เพิ่มผ่านการสมัคร
ทุกการแก้ไขต้องระบุเหตุผล และส่ง version เพื่อป้องกันเขียนทับข้อมูลที่ถูกเปลี่ยนไปแล้ว

## การเปิด Admin คนแรกในโปรเจกต์ใหม่
เจ้าของ Supabase ใช้ Admin Auth API ฝั่งที่เชื่อถือได้ สร้างบัญชีพร้อม user_metadata.full_name และ user_metadata.student_id
Trigger จะสร้างเป็น Student จากนั้นเจ้าของโปรเจกต์กำหนด Admin ผ่าน SQL Editor พร้อมบันทึก bootstrap_admin ใน portal_audit_log ภายใน transaction เดียว
อย่าเพิ่ม Admin จากอีเมลที่ส่งมาทางฟอร์มสมัคร และอย่าใส่รหัสผ่านใน SQL หรือ Git
หลังติดตั้ง trigger นี้ การสร้างบัญชีจาก Dashboard ที่ไม่มี full_name/student_id จะไม่ผ่าน ให้ใช้แบบสมัครหรือ Admin Auth API พร้อม metadata

## ขอบเขตที่ยังเป็นตัวอย่าง
ทุน ใบสมัคร เอกสาร โปรไฟล์เพิ่มเติม การให้คะแนน การแจ้งเตือน และจ่ายทุนยังเป็น mock
ข้อมูลพื้นฐานของ Admin บันทึกจริง แต่ยังไม่ได้เชื่อมเข้าฟอร์ม mock เหล่านี้
Admin จัดการสถานะเข้า portal ไม่ใช่ลบ/ban บัญชี Auth; session เดิมถูกปฏิเสธโดยการตรวจ active ใน request ถัดไป

## สิทธิ์และฐานข้อมูล
- ทุกหน้า/Server Action ของ Admin ตรวจ requireRole(["admin"]); ทุก RPC ตรวจ JWT auth.uid และ active Admin ซ้ำ
- profile อ่านได้เฉพาะตนเองหรือ Admin; audit อ่านได้เฉพาะ Admin; ข้อมูลพื้นฐานที่เปิดใช้งานอ่านได้โดยสมาชิก active
- ไม่มี authenticated INSERT/UPDATE/DELETE grants บนทั้งสามตาราง แม้ Admin ก็ต้องใช้ RPC
- public RPC เป็น SECURITY INVOKER; implementation อยู่ private schema, pin search_path, ตรวจสิทธิ์ก่อนเขียน และเขียน audit ใน transaction เดียว
- audit เป็น append-only สำหรับบัญชีเว็บ ไม่ใช่ tamper-proof ต่อเจ้าของฐานข้อมูล/service_role
- proxy ต่ออายุคุกกี้และตั้ง cache header; การตรวจสิทธิ์จริงอยู่ใกล้ข้อมูล ไม่เชื่อ URL/header/user_metadata
- โมดูลใหม่ต้องมี RLS ตรวจ active/role/เจ้าของข้อมูลเอง อย่าให้ role จาก JWT เก่าข้ามสถานะที่ฐานข้อมูล

## ทดสอบ
npm run lint
npm run build

scripts/check-auth.mjs รับ JSON array ผ่าน stdin มี email,password,role สำหรับ student,staff,committee,admin อย่างละหนึ่งบัญชี
รันกับ production server และตั้ง AUTH_TEST_BASE_URL ถ้าไม่ใช่ localhost:3000
โปรแกรมตรวจ login, role, RLS, cache, route matrix และไม่พิมพ์รหัสผ่านหรือโทเคน
อย่าเก็บ JSON credentials ลงไฟล์หรือ Git

supabase/tests/admin_permissions.sql เป็น transaction test ที่สร้างข้อมูลชั่วคราวและ ROLLBACK ทั้งหมด ใช้กับโปรเจกต์ทดสอบที่มี Admin อย่างน้อยหนึ่งคน
ตรวจ forced Student, RLS, ห้ามเขียนตรง, เปลี่ยนบทบาทครั้งเดียว, ป้องกันยกระดับเป็น Admin, legacy pending/approve/reject, version, suspend/activate, audit, reference และป้องกัน Admin
ไฟล์ migration มีเวอร์ชันตรง remote history; อย่านำ migration เดิมไปรันซ้ำกับโปรเจกต์ทีมที่อัปเดตแล้ว

Supabase Advisor เดิมแจ้ง [Leaked Password Protection ยังปิด](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)
