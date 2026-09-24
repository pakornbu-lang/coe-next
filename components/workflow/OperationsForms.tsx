"use client";
import {useActionState, useEffect, useState} from "react";
import {useRouter} from "next/navigation";
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
export function InterviewControl({applications,people,interview:i,defaultDate=""}:{applications:{id:string;student_name:string;application_no:number}[];people:Person[];interview?:Interview;defaultDate?:string}){
 const [s,a,p]=useActionState(saveInterview,{error:"",success:""});
 const router=useRouter();
 const [start,setStart]=useState(local(i?.scheduled_at)|| (defaultDate ? defaultDate+"T09:00" : ""));
 const [end,setEnd]=useState(local(i?.ends_at)|| (defaultDate ? defaultDate+"T09:30" : ""));
 const [duration,setDuration]=useState(30);
 const [status,setStatus]=useState(i?.status??"scheduled");
 useEffect(()=>{if(s.success)router.refresh();},[s.success,router]);
 function selectStart(next:string,minutes=duration){
   setStart(next);
   if(next && !Number.isNaN(Date.parse(next+":00Z")))setEnd(new Date(Date.parse(next+":00Z")+minutes*60000).toISOString().slice(0,16));
 }
 return <form action={a} className="workflow-form"><input type="hidden" name="version" value={i?.version??""}/>
 {i?<input type="hidden" name="application_id" value={i.application_id}/>:<label>ใบสมัคร *<select name="application_id" required defaultValue={applications.length===1?applications[0].id:""}><option value="">เลือกใบสมัคร</option>{applications.map(x=><option key={x.id} value={x.id}>#{x.application_no} · {x.student_name}</option>)}</select></label>}
 <fieldset className="interview-time-picker"><legend>1. เลือกวันและเวลา (ประเทศไทย)</legend>
 <input type="hidden" name="start" value={start}/><input type="hidden" name="end" value={end}/>
 <div className="workflow-grid"><label>วันเริ่มสัมภาษณ์ *<input type="date" required value={start.slice(0,10)} onChange={e=>selectStart(e.target.value?e.target.value+"T"+(start.slice(11)||"09:00"):"")}/></label>
 <label>เวลาเริ่ม *<input type="time" required value={start.slice(11)} onChange={e=>selectStart(e.target.value && start.slice(0,10)?start.slice(0,10)+"T"+e.target.value:"")}/></label></div>
 <div className="workflow-actions" aria-label="เวลาเริ่มที่ใช้บ่อย">{["09:00","10:00","11:00","13:00","14:00","15:00"].map(time=><button type="button" className="btn secondary" key={time} disabled={!start.slice(0,10)} onClick={()=>selectStart(start.slice(0,10)+"T"+time)}>{time}</button>)}</div>
 <label>ระยะเวลาที่ใช้บ่อย<select value={duration} onChange={e=>{const minutes=Number(e.target.value);setDuration(minutes);selectStart(start,minutes);}}><option value={15}>15 นาที</option><option value={30}>30 นาที</option><option value={45}>45 นาที</option><option value={60}>1 ชั่วโมง</option></select></label>
 <label>สิ้นสุด *<input type="datetime-local" required min={start || undefined} value={end} onChange={e=>setEnd(e.target.value)}/></label>
 {start && end && end<=start && <p role="alert" className="workflow-error">เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม</p>}
 <p className="workflow-muted">ปุ่มเวลาเป็นทางลัด ไม่ได้ยืนยันว่าช่วงเวลาว่าง ระบบจะตรวจเวลาซ้อนของกรรมการ นักศึกษา และสถานที่เมื่อบันทึก</p></fieldset>
 <fieldset><legend>2. ผู้สัมภาษณ์และสถานที่</legend><div className="workflow-grid">
 <label>กรรมการสัมภาษณ์ *<select name="interviewer" required defaultValue={i?.interviewer_id??""}><option value="">เลือกกรรมการ</option>{people.map(x=><option key={x.id} value={x.id}>{x.full_name}</option>)}</select></label>
 <label>สถานที่ / ห้อง *<input name="location" required minLength={2} maxLength={300} defaultValue={i?.location}/></label>
 <label>ลิงก์ออนไลน์<input name="url" type="url" maxLength={1000} defaultValue={i?.meeting_url??""}/></label>
 <label>สถานะ<select name="status" value={status} onChange={e=>setStatus(e.target.value)}><option value="scheduled">นัดหมายแล้ว</option><option value="completed">สัมภาษณ์แล้ว</option><option value="cancelled">ยกเลิก</option><option value="no_show">ไม่มาตามนัด</option></select></label></div></fieldset>
 <label>คำแนะนำถึงผู้สมัคร<textarea name="note" maxLength={2000} defaultValue={i?.note}/></label>
 <label>ผลสัมภาษณ์ {status==="completed" && "*"}<textarea name="outcome" required={status==="completed"} minLength={status==="completed"?3:undefined} maxLength={2000} defaultValue={i?.outcome}/></label>
 <button className="btn" disabled={p || !start || !end || end<=start}>{p?"กำลังบันทึก…":"บันทึกและแจ้งผู้เกี่ยวข้อง"}</button>
 {s.error&&<p role="alert">{s.error}</p>}{s.success&&<p role="status">{s.success}</p>}</form>;
}
