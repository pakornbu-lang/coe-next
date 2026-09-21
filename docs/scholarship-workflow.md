# Workflow ทุนการศึกษา

ระบบใช้หนึ่งประกาศทุนต่อหนึ่งรอบรับสมัคร แต่ละรอบระบุวันเปิด–ปิด จำนวนโควตา เอกสารที่ต้องใช้ และเกณฑ์คะแนนของตัวเอง จึงป้องกันการสมัครซ้ำในรอบเดียวกันด้วย `UNIQUE(scholarship_id, student_id)`

## บทบาทและขอบเขต

| บทบาท | ทำได้ |
| --- | --- |
| Student | กรอก/แก้ไขร่างใบสมัคร อัปโหลดเอกสาร ส่งใบสมัคร ดูผลและการจ่ายเงินของตน |
| Staff | สร้างทุน ตรวจเอกสาร ส่งกลับแก้ไข มอบหมายกรรมการ ตัดสินผล และบันทึกการจ่ายเงิน |
| Committee | เห็นเฉพาะใบสมัครที่ได้รับมอบหมาย เปิดเอกสารและส่งผลประเมินของตน |
| Admin | ดูแลบัญชี บทบาท ข้อมูลพื้นฐาน และ audit log |

กรรมการไม่เห็นบัญชีรับเงินหรือรายการจ่ายทุน ข้อมูลบัญชีอยู่ใน `application_payment_accounts` แยกจากข้อมูลใบสมัครและ RLS อนุญาตเฉพาะ Student เจ้าของข้อมูลกับ Staff

## สถานะ

```text
draft → submitted → revision_requested → submitted
                 ↘ ready_for_review → committee_review → approved | reserve | rejected
approved → disbursement: pending | paid | failed
```

- Student ส่งใบสมัครได้เมื่อกรอกคณะ สาขา GPA เหตุผล บัญชีรับเงิน และเอกสารที่บังคับครบ
- Staff ยืนยันเอกสารครบแล้วระบบเปลี่ยนเป็น `ready_for_review`
- Staff มอบหมายกรรมการแล้วระบบเปลี่ยนเป็น `committee_review`
- ต้องมีผลประเมินที่ส่งแล้วอย่างน้อยหนึ่งรายการก่อน Staff ตัดสินผล
- การอนุมัติล็อกแถวทุนและตรวจ quota ภายใน transaction เดียว
- การจ่ายทุนบันทึกจำนวนเงิน วันที่ เลขอ้างอิง และหลักฐานได้ แต่ไม่มีคำสั่งโอนเงินไปยังธนาคาร

## Supabase ที่ migration สร้าง

- ตาราง `scholarships`, `scholarship_document_requirements`, `scholarship_review_criteria`
- ตาราง `applications`, `application_documents`, `review_assignments`, `evaluations`, `application_status_history`
- ตาราง `application_payment_accounts`, `disbursements`, `portal_notifications`
- buckets private: `scholarship-documents` และ `scholarship-payment-proofs`
- RPC ที่ตรวจ JWT/บทบาท/สถานะ/optimistic version และเขียน `portal_audit_log`

ห้าม grant สิทธิ์เขียนตารางเหล่านี้ให้ client โดยตรง และห้ามใช้ service-role key ใน Next.js client การอัปโหลดทำผ่าน Server Action แล้ว Storage policy ตรวจเจ้าของใบสมัครหรือ Staff ซ้ำ

## รายการทดสอบก่อนเปิดใช้งาน

1. สมัครบัญชี Student แล้วตรวจว่า `portal_profiles` ได้ role `student` เสมอ
2. Admin กำหนด Staff และ Committee อย่างน้อยอย่างละหนึ่งบัญชี
3. Staff สร้างทุนแบบ draft แล้ว publish โดยตั้งวันเปิด/ปิดในอนาคตหรือปัจจุบัน
4. Student บันทึกร่าง อัปโหลดเอกสาร ส่งใบสมัคร และยืนยันว่าบัญชีอื่นเปิดเอกสารไม่ได้
5. Staff ส่งกลับแก้ไข แล้ว Student แทนที่เอกสารและส่งใหม่
6. Staff มอบหมาย Committee; Committee ต้องเห็นเฉพาะงานตนเองและไม่เห็นบัญชีรับเงิน
7. Committee ส่งคะแนน; Staff ตัดสินผล และลองอนุมัติเกิน quota เพื่อยืนยันว่าระบบปฏิเสธ
8. Staff บันทึกการโอนและเปิดหลักฐานด้วยทั้งบัญชีนักศึกษาเจ้าของใบสมัครและ Staff
9. Admin ตรวจ `portal_audit_log` ว่ามีเหตุผลและผู้ทำรายการของการเปลี่ยนสถานะสำคัญ
