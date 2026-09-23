import {requireRole} from "@/lib/auth/server";
import {createClient} from "@/lib/supabase/server";
import {thaiDate} from "@/lib/scholarships/types";
export default async function Page(){
 const v=await requireRole(["committee"]),c=await createClient();
 const {data,error}=await c.from("application_interviews").select("id,scheduled_at,ends_at,location,meeting_url,note,status").eq("interviewer_id",v.id).order("scheduled_at");
 if(error)throw Error("โหลดนัดไม่ได้ กรุณาตรวจ migration");
 return <div className="workflow-stack"><h1>นัดสัมภาษณ์ของฉัน</h1>{data.map(i=><section className="panel" key={i.id}><h2>{thaiDate(i.scheduled_at,true)}</h2><p>ถึง {thaiDate(i.ends_at,true)} · {i.location} · {i.status}</p><p>{i.note}</p>{i.meeting_url&&i.meeting_url.startsWith("https://")&&<a href={i.meeting_url} target="_blank" rel="noreferrer">เปิดห้องสัมภาษณ์</a>}</section>)}{!data.length&&<p>ยังไม่มีนัด</p>}</div>;
}
