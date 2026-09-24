import Link from "next/link";
import { requireRole } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { thaiDate } from "@/lib/scholarships/types";
import styles from "./interviews.module.css";

export const metadata = { title: "นัดสัมภาษณ์ของฉัน" };
const statusLabels: Record<string, string> = { scheduled: "นัดหมายแล้ว", completed: "สัมภาษณ์แล้ว", cancelled: "ยกเลิก", no_show: "ไม่มาตามนัด" };

function CalendarIllustration() {
  return <svg viewBox="0 0 180 150" width="180" height="150" fill="none" aria-hidden="true">
    <circle cx="90" cy="76" r="66" fill="#e7f3ec"/>
    <rect x="36" y="31" width="108" height="96" rx="16" fill="white" stroke="#9cc7b5" strokeWidth="2"/>
    <path d="M37 60h106" stroke="#c5dfd1" strokeWidth="2"/>
    <path d="M65 24v17m50-17v17" stroke="#357a65" strokeWidth="6" strokeLinecap="round"/>
    <rect x="53" y="74" width="17" height="13" rx="4" fill="#d6e9de"/><rect x="81" y="74" width="17" height="13" rx="4" fill="#d6e9de"/>
    <rect x="53" y="98" width="17" height="13" rx="4" fill="#d6e9de"/><rect x="81" y="98" width="17" height="13" rx="4" fill="#d6e9de"/>
    <circle cx="134" cy="113" r="25" fill="#357a65" stroke="white" strokeWidth="5"/>
    <path d="M134 101v13l8 5" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>;
}

export default async function Page() {
  const viewer = await requireRole(["committee"]);
  const client = await createClient();
  const { data, error } = await client.from("application_interviews")
    .select("id,scheduled_at,ends_at,location,meeting_url,note,status")
    .eq("interviewer_id", viewer.id).order("scheduled_at");
  if (error) throw Error("โหลดนัดสัมภาษณ์ไม่ได้ กรุณาลองใหม่");
  const interviews = data ?? [];
  return <div className={`workflow-stack ${styles.page}`}>
    <header className={styles.heading}><div><span className={styles.eyebrow}>ตารางงานกรรมการ</span>
      <h1>นัดสัมภาษณ์ของฉัน</h1><p>ตรวจสอบวันเวลา สถานที่ และคำแนะนำสำหรับการสัมภาษณ์ที่ได้รับมอบหมาย</p></div>
      <span className={styles.count}>{interviews.length} รายการ</span>
    </header>
    {interviews.length === 0 ? <section className={styles.empty} aria-labelledby="no-interviews-title">
      <CalendarIllustration/><span className={styles.tag}>ยังไม่มีการนัดหมาย</span>
      <h2 id="no-interviews-title">เมื่อมีนัดสัมภาษณ์ คุณจะเห็นที่นี่</h2>
      <p>ขณะนี้ยังไม่มีนัดสัมภาษณ์ที่มอบหมายให้คุณ<br/>เมื่อเจ้าหน้าที่กำหนดนัด ระบบจะแสดงวันเวลาและรายละเอียดในหน้านี้</p>
      <div className={styles.actions}><Link className="btn" href="/committee">ดูงานประเมินของฉัน <span aria-hidden="true">→</span></Link>
        <Link className="btn secondary" href="/notifications">ดูการแจ้งเตือน</Link></div>
      <div className={styles.notice}>ติดตามนัดใหม่หรือการเปลี่ยนแปลงได้จากกระดิ่งแจ้งเตือนข้างรูปโปรไฟล์</div>
    </section> : <section className={styles.list} aria-label="รายการนัดสัมภาษณ์">{interviews.map(interview => <article className={`panel ${styles.appointment}`} key={interview.id}>
      <div className={styles.appointmentHeader}><h2>{thaiDate(interview.scheduled_at, true)}</h2><span className={styles.tag}>{statusLabels[interview.status] ?? "ไม่ทราบสถานะ"}</span></div>
      <dl className={styles.facts}><div><dt>สิ้นสุด</dt><dd>{interview.ends_at ? thaiDate(interview.ends_at, true) : "ยังไม่ระบุ"}</dd></div>
        <div><dt>สถานที่</dt><dd>{interview.location || "ยังไม่ระบุ"}</dd></div></dl>
      {interview.note && <p className="workflow-preserve">{interview.note}</p>}
      {interview.meeting_url?.startsWith("https://") && <a className="btn secondary" href={interview.meeting_url} target="_blank" rel="noopener noreferrer">เปิดห้องสัมภาษณ์ ↗</a>}
    </article>)}</section>}
    <section className={styles.preparation} aria-labelledby="interview-preparation"><div><span className={styles.eyebrow}>เตรียมพร้อมก่อนวันนัด</span><h2 id="interview-preparation">เช็กลิสต์สำหรับกรรมการ</h2></div>
      <ol className={styles.steps}><li><span>01</span><div><h3>ทบทวนข้อมูลผู้สมัคร</h3><p>อ่านใบสมัครและเอกสารของงานที่ได้รับมอบหมาย</p></div></li>
        <li><span>02</span><div><h3>ตรวจสอบรายละเอียดนัด</h3><p>ดูวันเวลา สถานที่ หรือลิงก์ห้องสัมภาษณ์ให้ครบ</p></div></li>
        <li><span>03</span><div><h3>เตรียมประเด็นคำถาม</h3><p>ใช้หลักเกณฑ์ของทุนประกอบการสัมภาษณ์และประเมิน</p></div></li></ol>
    </section>
  </div>;
}
