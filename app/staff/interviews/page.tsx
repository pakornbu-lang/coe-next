import Link from "next/link";
import { requireRole } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { InterviewControl, type Interview } from "@/components/workflow/OperationsForms";
import InterviewCalendar from "@/components/workflow/InterviewCalendar";
import { thaiDate } from "@/lib/scholarships/types";
import { bangkokDate, interviewApplicationStatuses } from "@/lib/scholarships/interviews";

// หน้าตารางสัมภาษณ์ /staff/interviews สำหรับเจ้าหน้าที่ อ่านตาราง application_interviews
// แก้ตัวกรองและรายการนัด: หน้านี้ | แก้ตารางเดือน: components/workflow/InterviewCalendar.tsx
// แก้ฟอร์มวันเวลา/กรรมการ/สถานที่: InterviewControl ใน components/workflow/OperationsForms.tsx
// แก้การบันทึก: saveInterview ใน app/actions/review-operations.ts -> staff_schedule_interview_v2
// แก้สถานะใบสมัครที่นัดได้: lib/scholarships/interviews.ts และกฎ RPC ใน migration ใหม่ต้องตรงกัน
export default async function Page({ searchParams }: { searchParams: Promise<{ date?: string; scholarship?: string; /* ข้อมูลทุนที่ใบสมัครอ้างถึง */ application?: string /* ข้อมูลใบสมัคร */ }> }) {
  await requireRole(["staff"]);
  const filters = await searchParams /* ตัวกรองที่อ่านจาก query string ของ URL */, client = await createClient() /* Supabase client ที่ใช้ session ของผู้ใช้ปัจจุบัน */;

// เลือกคอลัมน์ของนัดที่ใช้ทั้งแสดงผลและเติมฟอร์มแก้ไข
// เพิ่มฟิลด์นัดใหม่ให้แก้ตารางด้วย migration, type Interview, select นี้, ฟอร์ม และ RPC ให้ครบ
  let interviewQuery = client
    .from("application_interviews")
    .select("id,application_id,scheduled_at,ends_at,interviewer_id,location,meeting_url,note,status,outcome,version")
    .order("scheduled_at") /* คำสั่งอ่านรายการนัด สามารถต่อเงื่อนไขกรองก่อนส่ง query ได้ */;

  if (filters.application) {
    interviewQuery = interviewQuery.eq("application_id", filters.application);
  }

  let applicationQuery = client
    .from("applications")
    .select("id,student_name,application_no,scholarship_id,status")
    .in("status", interviewApplicationStatuses) /* คำสั่งอ่านใบสมัครที่เข้าเงื่อนไขการนัดสัมภาษณ์ */;

  if (filters.application) {
    applicationQuery = applicationQuery.eq("id", filters.application);
  }

  if (filters.scholarship) {
    applicationQuery = applicationQuery.eq("scholarship_id", filters.scholarship);
  }

// ดึงนัด กรรมการ ใบสมัคร และทุนพร้อมกัน; รายชื่อกรรมการจำกัดบัญชี active
// ตัวกรอง application/scholarship มาจาก URL ส่วนสิทธิ์อ่านข้อมูลยังบังคับด้วย RLS ของฐานข้อมูล
  const [interviews, people, applications, scholarships] = await Promise.all([
    interviewQuery,
    client.from("portal_profiles").select("id,full_name").eq("role", "committee").eq("active", true),
    applicationQuery,
    client.from("scholarships").select("id,title"),
  ]) /* ผล query นัดสัมภาษณ์ กรรมการ ใบสมัคร และทุน ตามลำดับ */;
  if (interviews.error || people.error || applications.error || scholarships.error) throw Error("โหลดตารางสัมภาษณ์ไม่ได้");

  const applicationById = new Map(applications.data.map(item => [item.id, item])) /* Map สำหรับค้นข้อมูลใบสมัครด้วยรหัสโดยไม่ต้องวนหาใหม่ทุกครั้ง */;
  const personById = new Map(people.data.map(person => [person.id, person])) /* Map สำหรับค้นชื่อกรรมการด้วยรหัสบัญชี */;
  const interviewApplicationIds = new Set(interviews.data.map(item => item.application_id)) /* Set ของรหัสใบสมัครที่มีข้อมูลนัด */;
  const eligible = applications.data;
  const eligibleApplicationIds = new Set(eligible.map(item => item.id));
  const matches = (interviews.data as Interview[]).filter(item =>
    (!filters.application || item.application_id === filters.application) &&
    (!filters.scholarship || applicationById.get(item.application_id)?.scholarship_id === filters.scholarship));
  const requestedDate = filters.date && /^\d{4}-\d{2}-\d{2}$/.test(filters.date) && !Number.isNaN(Date.parse(filters.date)) ? filters.date : null;
  const date = requestedDate ?? (filters.application && matches[0] ? bangkokDate(matches[0].scheduled_at) : bangkokDate(new Date().toISOString()));
  const rows = matches.filter(item => bangkokDate(item.scheduled_at) === date) /* รายการงานหลังใช้ตัวกรองจาก URL */;
  const counts: Record<string, number> = {};
  for (const item of matches) if (item.status !== "cancelled") { const day = bangkokDate(item.scheduled_at); counts[day] = (counts[day] ?? 0) + 1; }
  const unscheduled = eligible.filter(app => (!filters.application || app.id === filters.application) && (!filters.scholarship || app.scholarship_id === filters.scholarship) && !interviewApplicationIds.has(app.id));
  return <div className="workflow-stack"><section className="panel"><h1>ตารางสัมภาษณ์</h1><p>เลือกวัน ดูนัด แล้วกำหนดเวลา ระบบตรวจเวลาซ้อนก่อนบันทึก</p>
    <form className="workflow-inline-form">{filters.application && <input type="hidden" name="application" value={filters.application}/>}
      <label>วันที่<input type="date" name="date" defaultValue={date}/></label><label>ทุน<select name="scholarship" defaultValue={filters.scholarship ?? ""}><option value="">ทุกทุน</option>{scholarships.data.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
      <div className="evaluation-filter-actions"><button className="btn">แสดงรายการ</button><Link className="btn secondary" href="/staff/interviews">วันนี้ / ล้างตัวกรอง</Link></div></form>
    {filters.application && <p><Link href={`/staff/review/${filters.application}`}>กลับใบสมัครที่เลือก</Link> · กำลังแสดงเฉพาะใบสมัครนี้</p>}</section>
    <div className="interview-layout"><InterviewCalendar date={date} counts={counts} scholarship={filters.scholarship} application={filters.application}/>
      <section className="workflow-stack"><div className="panel"><h2>นัดวันที่ {thaiDate(`${date}T00:00:00+07:00`)}</h2><p>{rows.length} รายการ</p></div>
        {rows.map(item => {
          const app = applicationById.get(item.application_id);
          return <article className="panel interview-agenda-item" key={`${item.id}:${item.version}`}>
            <h3>#{app?.application_no} · {app?.student_name}</h3><p className="interview-time">{thaiDate(item.scheduled_at, true)} – {item.ends_at ? thaiDate(item.ends_at, true) : "—"}</p>
            <p>สถานที่: {item.location}</p><p>กรรมการ: {personById.get(item.interviewer_id)?.full_name ?? "ยังไม่ระบุ"}</p>
            <p>สถานะ: {{ scheduled: "นัดหมายแล้ว", completed: "สัมภาษณ์แล้ว", cancelled: "ยกเลิก", no_show: "ไม่มาตามนัด" }[item.status] ?? item.status}</p>
            <p>ผลสัมภาษณ์: {item.outcome || "ยังไม่บันทึก"}</p><Link href={`/staff/review/${item.application_id}`}>เปิดใบสมัคร</Link>
            {eligibleApplicationIds.has(item.application_id) && <details><summary>แก้นัด / บันทึกผล</summary><InterviewControl interview={item} applications={eligible} people={people.data}/></details>}
          </article>;
        })}
        {!rows.length && <p className="panel">ยังไม่มีนัดในวันที่เลือก เลือกวันอื่นหรือเพิ่มนัดด้านล่าง</p>}
      </section></div>
    <section className="panel"><h2>เพิ่มนัดสัมภาษณ์</h2>{unscheduled.length ? <InterviewControl key={`${date}:${filters.application ?? ""}`} applications={unscheduled} people={people.data} defaultDate={date}/> : <p>ไม่มีใบสมัครที่รอเพิ่มนัดในตัวกรองนี้ หากมีนัดอยู่แล้ว ให้เลือกวันที่ของนัดแล้วกด “แก้นัด / บันทึกผล”</p>}</section>
  </div>;
}
