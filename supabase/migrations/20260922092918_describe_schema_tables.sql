-- Table descriptions shown by database tools. No rows, keys, policies or
-- application behavior change in this migration.

comment on table public.portal_profiles is
  'บัญชีผู้ใช้ของเว็บ: ชื่อ บทบาท สถานะ และข้อมูลโปรไฟล์ เชื่อมกับ auth.users แบบ 1:1; ไม่เก็บรหัสผ่าน';
comment on table public.portal_reference_data is
  'ข้อมูลตัวเลือกกลาง เช่น ประเภททุน คณะ และสาขา ที่ผู้ดูแลระบบจัดการ';
comment on table public.scholarships is
  'ประกาศทุนหนึ่งรอบ: รายละเอียด วงเงิน จำนวนรับ ช่วงสมัคร สถานะ และการประกาศผล';
comment on table public.scholarship_document_requirements is
  'รายการเอกสารที่ต้องใช้ตามประกาศทุน; หนึ่งทุนกำหนดได้หลายรายการ';
comment on table public.scholarship_review_criteria is
  'เกณฑ์และคะแนนเต็มสำหรับกรรมการประเมินตามประกาศทุน';
comment on table public.applications is
  'ใบสมัครทุนของนักศึกษา: หนึ่งนักศึกษาสมัครแต่ละประกาศทุนได้หนึ่งใบ';
comment on table public.application_payment_accounts is
  'ข้อมูลบัญชีรับเงินของใบสมัคร แยกจากใบสมัครเพื่อควบคุมการเข้าถึงข้อมูลการเงิน';
comment on table public.application_documents is
  'ไฟล์หลักฐานที่นักศึกษาอัปโหลดตามรายการเอกสารของทุน พร้อมผลการตรวจ';
comment on table public.application_status_history is
  'ประวัติเปลี่ยนสถานะใบสมัครแบบเพิ่มรายการใหม่เพื่อใช้ติดตามย้อนหลัง';
comment on table public.review_assignments is
  'การมอบหมายใบสมัครให้กรรมการแต่ละคน รวมสถานะงานและการแจ้งผลประโยชน์ทับซ้อน';
comment on table public.evaluations is
  'ผลประเมินของการมอบหมายหนึ่งรายการ รองรับฉบับร่าง คะแนน และความเห็น';
comment on table public.application_interviews is
  'นัดสัมภาษณ์ของใบสมัครหนึ่งใบ พร้อมสถานที่ ลิงก์ และสถานะนัด';
comment on table public.application_appeals is
  'คำอุทธรณ์ผลทุนของใบสมัครหนึ่งใบ พร้อมคำตอบและผู้พิจารณา';
comment on table public.disbursements is
  'ผลการจ่ายทุนและหลักฐานโอนเงินของใบสมัครที่ได้รับทุน แยกเพื่อควบคุมข้อมูลการเงิน';
comment on table public.portal_notifications is
  'แจ้งเตือนที่แสดงภายในเว็บสำหรับผู้ใช้แต่ละคน';
comment on table public.notification_email_outbox is
  'คิวอีเมลฝั่งเซิร์ฟเวอร์ของแจ้งเตือน เก็บสถานะส่ง จำนวนครั้งที่ลอง และข้อผิดพลาด';
comment on table public.portal_audit_log is
  'บันทึกการแก้ไขและการตัดสินใจสำคัญของระบบ ใช้ตรวจสอบย้อนหลัง';
comment on table public.password_reset_rate_limits is
  'ตัวนับคำขออีเมลกู้รหัสผ่านฝั่งเซิร์ฟเวอร์ ใช้แฮชอีเมล ไม่เก็บอีเมลต้นฉบับ';
