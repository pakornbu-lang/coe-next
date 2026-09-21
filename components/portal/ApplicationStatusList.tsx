import Link from "next/link";
import { Badge, Panel } from "./Shared";

export type ApplicationStatusItem = {
  id: string;
  title: string;
  status: string;
  submittedAt: string;
  href: string;
};

export default function ApplicationStatusList({ items, loading = false, error = "", demo = false }: {
  items: ApplicationStatusItem[];
  loading?: boolean;
  error?: string;
  demo?: boolean;
}) {
  return <Panel title="สถานะใบสมัครของฉัน" action={<Link href="/applications">ดูทั้งหมด ›</Link>}>
    {demo && <p className="section-subtitle">รายการทดลองบนเบราว์เซอร์นี้ ยังไม่ได้ส่งใบสมัครจริง</p>}
    {loading ? <p role="status">กำลังโหลดใบสมัคร…</p> : error ? <p role="alert">{error}</p> : items.length === 0 ? <>
      <p>{demo ? "ยังไม่มีรายการที่ทดลองสมัคร" : "ยังไม่มีใบสมัครที่ส่งแล้ว"}</p>
      <Link className="btn secondary" href="/scholarships">ค้นหาทุนการศึกษา</Link>
    </> : <ul className="dashboard-applications">
      {items.map(item => <li key={item.id} id={`application-${item.id}`}>
        <Link href={item.href}><strong>{item.title}</strong><span>ดูรายละเอียด ›</span></Link>
        <p><time dateTime={item.submittedAt}>{new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(new Date(item.submittedAt))}</time></p>
        <Badge>{item.status}</Badge>
      </li>)}
    </ul>}
  </Panel>;
}
