# การเชื่อมระบบทะเบียน (SIS)

ระบบทุนเรียก `GET` ไปยัง `SIS_API_URL` พร้อม query `student_id` และ header `Authorization: Bearer <SIS_API_TOKEN>` เฉพาะฝั่งเซิร์ฟเวอร์ โดยกำหนด timeout 5 วินาทีและไม่เก็บ cache หาก SIS ใช้งานไม่ได้ แบบฟอร์มจะใช้ข้อมูลโปรไฟล์เดิมต่อโดยไม่ขัดขวางการสมัคร

ตัวอย่าง response:

```json
{
  "data": {
    "faculty": "สำนักวิชาสารสนเทศศาสตร์",
    "major": "วิศวกรรมซอฟต์แวร์",
    "education_level": "ปริญญาตรี",
    "study_year": 3,
    "gpa": 3.25,
    "active": true
  }
}
```

ตั้งค่า `SIS_API_URL` เป็น HTTPS เท่านั้น และเก็บ `SIS_API_TOKEN` ใน environment variables ของเซิร์ฟเวอร์ ห้ามใช้ชื่อที่ขึ้นต้นด้วย `NEXT_PUBLIC_` ควรจำกัด token ให้มีสิทธิ์อ่านเฉพาะข้อมูลการศึกษาที่จำเป็น และให้ API บันทึก audit log ทุกคำขอ
