import Link from "next/link";
import { requireRole } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { InterviewControl, type Interview } from "@/components/workflow/OperationsForms";
import InterviewCalendar from "@/components/workflow/InterviewCalendar";
import { thaiDate } from "@/lib/scholarships/types";
import { bangkokDate, interviewApplicationStatuses } from "@/lib/scholarships/interviews";

export default async function Page({ searchParams }: { searchParams: Promise<{ date?: string; scholarship?: string; application?: string }> }) {
  await requireRole(["staff"]);
  const filters = await searchParams, client = await createClient();
  const [interviews, people, applications, scholarships] = await Promise.all([
    client.from("application_interviews").select("*").order("scheduled_at"),
    client.from("portal_profiles").select("id,full_name").eq("role", "committee").eq("active", true),
    client.from("applications").select("id,student_name,application_no,scholarship_id,status"),
    client.from("scholarships").select("id,title"),
  ]);
  if (interviews.error || people.error || applications.error || scholarships.error) throw Error("โหลดตารางสัมภาษณ์ไม่ได้");
  const eligible = applications.data.filter(item => interviewApplicationStatuses.includes(item.status));
  const matches = (interviews.data as Interview[]).filter(item =>
    (!filters.application || item.application_id === filters.application) &&
    (!filters.scholarship || applications.data.find(app => app.id === item.application_id)?.scholarship_id === filters.scholarship));
  const requestedDate = filters.date && /^\d{4}-\d{2}-\d{2}$/.test(filters.date) && !Number.isNaN(Date.parse(filters.date)) ? filters.date : null;
  const date = requestedDate ?? (filters.application && matches[0] ? bangkokDate(matches[0].scheduled_at) : bangkokDate(new Date().toISOString()));
  const rows = matches.filter(item => bangkokDate(item.scheduled_at) === date);
  const counts: Record<string, number> = {};
  for (const item of matches) if (item.status !== "cancelled") { const day = bangkokDate(item.scheduled_at); counts[day] = (counts[day] ?? 0) + 1; }
  const unscheduled = eligible.filter(app => (!filters.application || app.id === filters.application) && (!filters.scholarship || app.scholarship_id === filters.scholarship) && !interviews.data.some(item => item.application_id === app.id));
  return <div className="workflow-stack"><section className="panel"><h1>ตารางสัมภาษณ์</h1><p>เลือกวัน ดูนัด แล้วกำหนดเวลา ระบบตรวจเวลาซ้อนก่อนบันทึก</p>
    <form className="workflow-inline-form">{filters.application && <input type="hidden" name="application" value={filters.application}/>}
      <label>วันที่<input type="date" name="date" defaultValue={date}/></label><label>ทุน<select name="scholarship" defaultValue={filters.scholarship ?? ""}><option value="">ทุกทุน</option>{scholarships.data.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
      <div className="evaluation-filter-actions"><button className="btn">แสดงรายการ</button><Link className="btn secondary" href="/staff/interviews">วันนี้ / ล้างตัวกรอง</Link></div></form>
    {filters.application && <p><Link href={`/staff/review/${filters.application}`}>กลับใบสมัครที่เลือก</Link> · กำลังแสดงเฉพาะใบสมัครนี้</p>}</section>
    <div className="interview-layout"><InterviewCalendar date={date} counts={counts} scholarship={filters.scholarship} application={filters.application}/>
      <section className="workflow-stack"><div className="panel"><h2>นัดวันที่ {thaiDate(`${date}T00:00:00+07:00`)}</h2><p>{rows.length} รายการ</p></div>
        {rows.map(item => {
          const app = applications.data.find(app => app.id === item.application_id);
          return <article className="panel interview-agenda-item" key={`${item.id}:${item.version}`}>
            <h3>#{app?.application_no} · {app?.student_name}</h3><p className="interview-time">{thaiDate(item.scheduled_at, true)} – {item.ends_at ? thaiDate(item.ends_at, true) : "—"}</p>
            <p>สถานที่: {item.location}</p><p>กรรมการ: {people.data.find(person => person.id === item.interviewer_id)?.full_name ?? "ยังไม่ระบุ"}</p>
            <p>สถานะ: {{ scheduled: "นัดหมายแล้ว", completed: "สัมภาษณ์แล้ว", cancelled: "ยกเลิก", no_show: "ไม่มาตามนัด" }[item.status] ?? item.status}</p>
            <p>ผลสัมภาษณ์: {item.outcome || "ยังไม่บันทึก"}</p><Link href={`/staff/review/${item.application_id}`}>เปิดใบสมัคร</Link>
            {eligible.some(app => app.id === item.application_id) && <details><summary>แก้นัด / บันทึกผล</summary><InterviewControl interview={item} applications={eligible} people={people.data}/></details>}
          </article>;
        })}
        {!rows.length && <p className="panel">ยังไม่มีนัดในวันที่เลือก เลือกวันอื่นหรือเพิ่มนัดด้านล่าง</p>}
      </section></div>
    <section className="panel"><h2>เพิ่มนัดสัมภาษณ์</h2>{unscheduled.length ? <InterviewControl key={`${date}:${filters.application ?? ""}`} applications={unscheduled} people={people.data} defaultDate={date}/> : <p>ไม่มีใบสมัครที่รอเพิ่มนัดในตัวกรองนี้ หากมีนัดอยู่แล้ว ให้เลือกวันที่ของนัดแล้วกด “แก้นัด / บันทึกผล”</p>}</section>
  </div>;
}
