import Link from "next/link";

export default function InterviewCalendar({ date, counts, scholarship, application }: {
  date: string; counts: Record<string, number>; scholarship?: string; application?: string;
}) {
  const selected = new Date(`${date}T12:00:00Z`);
  const year = selected.getUTCFullYear(), month = selected.getUTCMonth();
  const first = new Date(Date.UTC(year, month, 1));
  const length = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const href = (day: string) => {
    const query = new URLSearchParams({ date: day });
    if (scholarship) query.set("scholarship", scholarship);
    if (application) query.set("application", application);
    return `/staff/interviews?${query}`;
  };
  return <section className="panel interview-calendar" aria-label="ปฏิทินนัดสัมภาษณ์">
    <div className="calendar-heading"><Link className="btn secondary" aria-label="เดือนก่อนหน้า" href={href(new Date(Date.UTC(year, month - 1, 1)).toISOString().slice(0, 10))}>‹</Link>
      <h2>{selected.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", month: "long", year: "numeric" })}</h2>
      <Link className="btn secondary" aria-label="เดือนถัดไป" href={href(new Date(Date.UTC(year, month + 1, 1)).toISOString().slice(0, 10))}>›</Link></div>
    <div className="calendar-grid">{["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."].map(day => <span className="calendar-weekday" key={day}>{day}</span>)}
      {Array.from({ length: first.getUTCDay() }, (_, index) => <span key={`empty-${index}`}/>)}
      {Array.from({ length }, (_, index) => {
        const day = `${year}-${String(month + 1).padStart(2, "0")}-${String(index + 1).padStart(2, "0")}`;
        return <Link key={day} href={href(day)} className={`calendar-day ${day === date ? "selected" : ""}`}
          aria-current={day === date ? "date" : undefined} aria-label={`${day} มี ${counts[day] ?? 0} นัด`}>
          <strong>{index + 1}</strong>{counts[day] ? <small>{counts[day]} นัด</small> : <small>—</small>}</Link>;
      })}</div><p className="workflow-muted">เลือกวันที่เพื่อดูรายการและเพิ่มนัด · เวลาประเทศไทย (UTC+7)</p>
  </section>;
}
