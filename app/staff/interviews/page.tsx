import Link from "next/link";
import {requireRole} from "@/lib/auth/server";
import {createClient} from "@/lib/supabase/server";
import {InterviewControl,type Interview} from "@/components/workflow/OperationsForms";
import {thaiDate} from "@/lib/scholarships/types";
export default async function Page({searchParams}:{searchParams:Promise<{date?:string;scholarship?:string;application?:string}>}){
 await requireRole(["staff"]);const f=await searchParams,c=await createClient();
 const [n,p,a,s]=await Promise.all([c.from("application_interviews").select("*").order("scheduled_at"),c.from("portal_profiles").select("id,full_name").eq("role","committee").eq("active",true),c.from("applications").select("id,student_name,application_no,scholarship_id,status"),c.from("scholarships").select("id,title")]);
 if(n.error||p.error||a.error||s.error)throw Error("โหลดตารางสัมภาษณ์ไม่ได้");
 const eligible=a.data.filter(x=>["ready_for_review","committee_review"].includes(x.status));
 const rows=(n.data as Interview[]).filter(i=>(!f.application||i.application_id===f.application)&&(!f.date||new Date(Date.parse(i.scheduled_at)+7*3600000).toISOString().slice(0,10)===f.date)&&(!f.scholarship||a.data.find(a=>a.id===i.application_id)?.scholarship_id===f.scholarship));
 return <div className="workflow-stack"><section className="panel"><h1>ตารางสัมภาษณ์</h1><p>ตรวจเวลาซ้อนของกรรมการ นักศึกษา และสถานที่ก่อนบันทึก</p><form className="workflow-inline-form"><label>วันที่<input type="date" name="date" defaultValue={f.date}/></label><label>ทุน<select name="scholarship" defaultValue={f.scholarship??""}><option value="">ทุกทุน</option>{s.data.map(x=><option key={x.id} value={x.id}>{x.title}</option>)}</select></label><button className="btn">กรอง</button></form></section>
 <details className="panel"><summary>เพิ่มนัดสัมภาษณ์</summary><InterviewControl applications={eligible.filter(a=>(!f.application||a.id===f.application)&&!n.data.some(i=>i.application_id===a.id))} people={p.data}/></details>
 {rows.map(i=>{const app=a.data.find(a=>a.id===i.application_id);return <section className="panel" key={i.id}><h2>#{app?.application_no} · {app?.student_name}</h2><p>{thaiDate(i.scheduled_at,true)} – {i.ends_at?thaiDate(i.ends_at,true):"—"} · {i.location}</p><p>{p.data.find(p=>p.id===i.interviewer_id)?.full_name??"ยังไม่ระบุกรรมการ"} · {i.status}</p><p>ผลสัมภาษณ์: {i.outcome||"ยังไม่บันทึก"}</p><Link href={"/staff/review/"+i.application_id}>เปิดใบสมัคร</Link>{eligible.some(a=>a.id===i.application_id)&&<details><summary>แก้นัด / บันทึกผล</summary><InterviewControl interview={i} applications={eligible} people={p.data}/></details>}</section>})}{!rows.length&&<p className="panel">ไม่มีนัดตรงกับตัวกรอง</p>}</div>;
}
