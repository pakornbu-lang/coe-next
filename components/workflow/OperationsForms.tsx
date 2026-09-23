"use client";
import {useActionState} from "react";
import {manageReview,saveInterview} from "@/app/actions/review-operations";
type Person={id:string;full_name:string};
export type Interview={id:string;application_id:string;scheduled_at:string;ends_at:string;interviewer_id:string|null;location:string;meeting_url:string|null;note:string;status:string;outcome:string;version:number};
const local=(s?:string|null)=>s?new Date(Date.parse(s)+7*3600000).toISOString().slice(0,16):"";
export function AssignmentControl({id,version,due,people}:{id:string;version:number;due:string|null;people:Person[]}){
 const [s,a,p]=useActionState(manageReview,{error:"",success:""});
 return <details><summary>กำหนดส่ง / เปลี่ยนกรรมการ / ถอนงาน</summary><form action={a} className="workflow-form">
 <input type="hidden" name="id" value={id}/><input type="hidden" name="version" value={version}/>
 <label>กำหนดส่ง<input type="datetime-local" name="due_at" defaultValue={local(due)}/></label>
 <label>เปลี่ยนกรรมการ<select name="replacement"><option value="">คงคนเดิม</option>{people.map(x=><option key={x.id} value={x.id}>{x.full_name}</option>)}</select></label>
 <label><input type="checkbox" name="revoke"/> ถอนงาน (ไม่เลือกพร้อมเปลี่ยนกรรมการ)</label>
 <label>เหตุผล<textarea name="reason" required minLength={3} maxLength={500}/></label>
 <button className="btn" disabled={p}>{p?"กำลังบันทึก…":"ยืนยันการเปลี่ยนแปลง"}</button>
 {s.error&&<p role="alert">{s.error}</p>}{s.success&&<p role="status">{s.success}</p>}</form></details>;
}
export function InterviewControl({applications,people,interview:i}:{applications:{id:string;student_name:string;application_no:number}[];people:Person[];interview?:Interview}){
 const [s,a,p]=useActionState(saveInterview,{error:"",success:""});
 return <form action={a} className="workflow-form"><input type="hidden" name="version" value={i?.version??""}/>
 {i?<input type="hidden" name="application_id" value={i.application_id}/>:<label>ใบสมัคร<select name="application_id" required><option value="">เลือกใบสมัคร</option>{applications.map(x=><option key={x.id} value={x.id}>#{x.application_no} · {x.student_name}</option>)}</select></label>}
 <div className="workflow-grid"><label>เริ่มสัมภาษณ์<input type="datetime-local" name="start" required defaultValue={local(i?.scheduled_at)}/></label><label>สิ้นสุด<input type="datetime-local" name="end" required defaultValue={local(i?.ends_at)}/></label>
 <label>กรรมการสัมภาษณ์<select name="interviewer" required defaultValue={i?.interviewer_id??""}><option value="">เลือกกรรมการ</option>{people.map(x=><option key={x.id} value={x.id}>{x.full_name}</option>)}</select></label>
 <label>สถานที่ / ห้อง<input name="location" required minLength={2} maxLength={300} defaultValue={i?.location}/></label>
 <label>ลิงก์ออนไลน์<input name="url" type="url" maxLength={1000} defaultValue={i?.meeting_url??""}/></label>
 <label>สถานะ<select name="status" defaultValue={i?.status??"scheduled"}><option value="scheduled">นัดหมายแล้ว</option><option value="completed">สัมภาษณ์แล้ว</option><option value="cancelled">ยกเลิก</option><option value="no_show">ไม่มาตามนัด</option></select></label></div>
 <label>คำแนะนำถึงผู้สมัคร<textarea name="note" maxLength={2000} defaultValue={i?.note}/></label>
 <label>ผลสัมภาษณ์ (จำเป็นเมื่อสัมภาษณ์แล้ว)<textarea name="outcome" maxLength={2000} defaultValue={i?.outcome}/></label>
 <button className="btn" disabled={p}>{p?"กำลังบันทึก…":"บันทึกและแจ้งผู้เกี่ยวข้อง"}</button>
 {s.error&&<p role="alert">{s.error}</p>}{s.success&&<p role="status">{s.success}</p>}</form>;
}
