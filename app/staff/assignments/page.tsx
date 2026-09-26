import Link from "next/link";
import {requireRole} from "@/lib/auth/server";
import {createClient} from "@/lib/supabase/server";
import {AssignmentControl} from "@/components/workflow/OperationsForms";
import {thaiDate} from "@/lib/scholarships/types";
// หน้าจัดการงานกรรมการ /staff/assignments (ฝั่งเซิร์ฟเวอร์)
// review_assignments เก็บว่าใบสมัครใดมอบหมายให้กรรมการคนใด ไม่ใช่คะแนนประเมิน
// แก้หัวข้อ ตัวกรอง และรายการงาน: แก้ JSX ในหน้านี้
// แก้ช่องกำหนดส่ง/เปลี่ยนกรรมการ/ถอนงาน: แก้ AssignmentControl ใน components/workflow/OperationsForms.tsx
// แก้การบันทึก: ตาม manageReview ใน app/actions/review-operations.ts ไปยัง RPC staff_manage_review
// เปลี่ยนกฎสิทธิ์หรือสถานะในฐานข้อมูล: เพิ่ม migration ใหม่ ไม่แก้เฉพาะการซ่อนปุ่ม
export default async function Page({searchParams}:{searchParams:Promise<{status?:string;reviewer?:string}>}){
 await requireRole(["staff"]);const f=await searchParams,c=await createClient();
// โหลดพร้อมกัน: r = งานกรรมการ, p = กรรมการที่ใช้งานได้, a = ใบสมัคร
// หากเพิ่มข้อมูลบนการ์ด ต้องเพิ่มคอลัมน์ใน select แล้วส่งต่อให้ฟอร์มที่ใช้ข้อมูลนั้นด้วย
 const [r,p,a]=await Promise.all([c.from("review_assignments").select("id,application_id,reviewer_id,status,due_at,version,conflict_status").order("assigned_at",{ascending:false}),c.from("portal_profiles").select("id,full_name").eq("role","committee").eq("active",true),c.from("applications").select("id,student_name,application_no")]);
 if(r.error||p.error||a.error)return <section className="panel"><h1>งานกรรมการ</h1><p>โหลดไม่ได้ กรุณาตรวจการเชื่อมต่อและติดตั้ง migration review_operations</p></section>;
 // This Server Component takes one request-time snapshot for overdue filters.
 // eslint-disable-next-line react-hooks/purity
 const pending=r.data.filter(x=>x.status==="assigned"),now=Date.now();
// ตัวกรองทำงานกับข้อมูลที่โหลดมาแล้ว: reviewer เลือกกรรมการ และ status เลือกสถานะ
// overdue เป็นเงื่อนไขคำนวณจาก due_at ของงาน assigned ไม่ใช่สถานะที่เก็บในตาราง
 const rows=r.data.filter(x=>(!f.reviewer||x.reviewer_id===f.reviewer)&&(!f.status||x.status===f.status||(f.status==="overdue"&&x.status==="assigned"&&x.due_at&&Date.parse(x.due_at)<now)));
 return <div className="workflow-stack"><section className="panel"><h1>จัดการงานกรรมการ</h1><p>ทั้งหมด {r.data.length} · ค้าง {pending.length} · ส่งแล้ว {r.data.filter(x=>x.status==="completed").length}</p><Link href="/staff/review">มอบหมายจากใบสมัคร</Link> · <Link href="/staff/evaluations">สรุปคะแนน</Link>
 <form className="workflow-inline-form"><label>สถานะ<select name="status" defaultValue={f.status??""}><option value="">ทั้งหมด</option><option value="assigned">ค้างประเมิน</option><option value="completed">ส่งแล้ว</option><option value="revoked">ถอนงาน</option><option value="overdue">เกินกำหนด</option></select></label><label>กรรมการ<select name="reviewer" defaultValue={f.reviewer??""}><option value="">ทุกคน</option>{p.data.map(x=><option key={x.id} value={x.id}>{x.full_name} · ค้าง {pending.filter(r=>r.reviewer_id===x.id).length}</option>)}</select></label><div className="evaluation-filter-actions"><button className="btn">กรอง</button></div></form></section>
 {rows.map(x=>{const app=a.data.find(a=>a.id===x.application_id);return <section className="panel" key={x.id}><h2>#{app?.application_no} · {app?.student_name}</h2><p>{p.data.find(p=>p.id===x.reviewer_id)?.full_name??"กรรมการที่ปิดใช้งาน"} · {x.status} · ผลประโยชน์ทับซ้อน: {x.conflict_status}</p><p>กำหนดส่ง {x.due_at?thaiDate(x.due_at,true):"ยังไม่กำหนด"} {x.status==="assigned"&&x.due_at&&Date.parse(x.due_at)<now?"— เกินกำหนด":""}</p><Link href={"/staff/review/"+x.application_id}>เปิดใบสมัคร</Link>{x.status==="assigned"&&<AssignmentControl id={x.id} version={x.version} due={x.due_at} people={p.data.filter(p=>p.id!==x.reviewer_id)}/>}</section>})}
 {!rows.length&&<p className="panel">ไม่มีรายการตรงกับตัวกรอง</p>}</div>;
}
