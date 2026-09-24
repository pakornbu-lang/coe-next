"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { type Scholarship, money, demoDate, screens } from "@/lib/ui-data";

export function Icon({
  name = "file",
  size = 23,
}: {
  name?: string;
  size?: number;
}) {
  const paths: Record<string, ReactNode> = {
    home: (
      <>
        <path d="m3 10 9-7 9 7v10H3Z" />
        <path d="M9 20v-7h6v7" />
      </>
    ),
    cap: (
      <>
        <path d="m2 8 10-5 10 5-10 5Z" />
        <path d="M6 10v7q6 5 12 0v-7M22 8v9" />
      </>
    ),
    search: (
      <>
        <circle cx="10" cy="10" r="7" />
        <path d="m15 15 6 6" />
      </>
    ),
    file: (
      <>
        <path d="M5 2h9l5 5v15H5Z M14 2v6h5M8 12h8M8 16h8" />
      </>
    ),
    folder: <path d="M2 6V4h7l3 3h10v14H2Z" />,
    user: (
      <>
        <circle cx="12" cy="7" r="4" />
        <path d="M3 22v-3a9 9 0 0 1 18 0v3" />
      </>
    ),
    people: (
      <>
        <circle cx="9" cy="7" r="4" />
        <path d="M1 21v-3a8 8 0 0 1 16 0v3M17 3a4 4 0 0 1 0 8M19 14q4 1 4 7" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 6v6l4 3" />
      </>
    ),
    check: <path d="m4 12 5 5L20 6" />,
    arrow: <path d="M3 12h18m-7-7 7 7-7 7" />,
    edit: (
      <>
        <path d="m14 4 6 6M3 21l2-7L17 2l5 5L10 19ZM12 3H3v18h18v-9" />
      </>
    ),
    chart: (
      <>
        <path d="M4 21V12h4v9M10 21V7h4v14M16 21V2h4v19" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M7 2v6M17 2v6M3 11h18" />
      </>
    ),
    money: (
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="M16 8c-5-4-10 3-4 4s1 8-4 4M12 4v16" />
      </>
    ),
    bell: (
      <>
        <path d="M5 16V9a7 7 0 0 1 14 0v7l2 3H3ZM9 22h6" />
      </>
    ),
    bookmark: <path d="M5 2h14v20l-7-5-7 5Z" />,
    upload: (
      <>
        <path d="M12 17V2m-6 6 6-6 6 6M3 15v7h18v-7" />
      </>
    ),
    mail: (
      <>
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="m2 5 10 8L22 5" />
      </>
    ),
    star: <path d="m12 2 3 6 7 1-5 5 1 8-6-4-6 4 1-8-5-5 7-1Z" />,
    trophy: (
      <>
        <path d="M7 3h10v8a5 5 0 0 1-10 0ZM7 5H2v4q0 5 6 5M17 5h5v4q0 5-6 5M12 16v6M7 22h10" />
      </>
    ),
    eye: (
      <>
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    "eye-off": (
      <>
        <path d="M3 3l18 18" />
        <path d="M10.6 10.7a2 2 0 0 0 2.7 2.7" />
        <path d="M9.9 4.2A10.8 10.8 0 0 1 12 4c5.5 0 9.5 5.2 10 8-.2 1.1-1 2.6-2.2 4" />
        <path d="M6.6 6.6C4.2 8 2.5 10.4 2 12c.5 2.8 4.5 8 10 8 1.5 0 2.8-.4 4-.9" />
      </>
    ),
  };
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name] || paths.file}
    </svg>
  );
}
export function Brand() {
  return (
    <Link className="brand" href="/">
      <span className="brand-leaf" />
      <span>
        <strong>
          ระบบติดตามทุนการศึกษา
        </strong>
        <small>ทุนภายในมหาวิทยาลัย</small>
      </span>
    </Link>
  );
}
export function Panel({
  children,
  className = "",
  title,
  action,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  action?: ReactNode;
}) {
  return (
    <section className={`panel ${className}`}>
      {title && (
        <div className="section-title">
          <h2>{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
export function Heading({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children}
    </div>
  );
}
export function Badge({ children }: { children: ReactNode }) {
  const s = String(children);
  return (
    <span
      className={`badge ${/ไม่|ครบ$/.test(s) && s !== "ครบ" ? "red" : /รอ/.test(s) ? "amber" : /พิจารณา|ประเมิน/.test(s) ? "blue" : ""}`}
    >
      {children}
    </span>
  );
}
export function Action({
  href,
  children,
  secondary = false,
}: {
  href: string;
  children: ReactNode;
  secondary?: boolean;
}) {
  return (
    <Link className={`btn ${secondary ? "secondary" : ""}`} href={href}>
      {children}
    </Link>
  );
}
export function Photo({ index = 0 }: { index?: number }) {
  return (
    <div
      className={`scholar-photo photo-${index}`}
      role="img"
      aria-label={
        [
          "หนังสือและต้นไม้",
          "คอมพิวเตอร์สำหรับการเรียนรู้",
          "นักศึกษาร่วมกิจกรรม",
          "เครื่องดนตรี",
          "อุปกรณ์วิจัย",
          "หนังสือเพื่อการศึกษา",
        ][index]
      }
    />
  );
}
export function ScholarshipCard({ item }: { item: Scholarship }) {
  const [saved, setSaved] = useState(false);
  return (
    <article className="scholar-card">
      <div className="card-photo">
        <Photo index={item.image} />
        <span className={`type-label type-${item.image}`}>{item.type}</span>
        <button
          className={`bookmark ${saved ? "saved" : ""}`}
          aria-label={saved ? "ยกเลิกบันทึกทุน" : "บันทึกทุน"}
          aria-pressed={saved}
          onClick={() => setSaved(!saved)}
        >
          <Icon name="bookmark" size={19} />
        </button>
      </div>
      <h3>{item.title}</h3>
      <p>{item.description}</p>
      <div className="card-meta">
        <span>
          <Icon name="money" size={18} />
          {money(item.amount)} บาท
        </span>
        <span>
          <Icon name="people" size={18} />
          {item.quota} ทุน
        </span>
      </div>
      <div className="deadline">
        <Icon name="calendar" size={18} />
        ปิดรับ {demoDate(item.date)}
      </div>
      <div className="button-row">
        <Action secondary href={`/scholarships/${item.id}`}>
          ดูรายละเอียด
        </Action>
        <Action href={`/apply?scholarship=${item.id}`}>สมัคร</Action>
      </div>
    </article>
  );
}
export function Banner({
  staff = false,
  title,
  text,
}: {
  staff?: boolean;
  title?: string;
  text?: string;
}) {
  return (
    <section className="welcome-banner">
      <div>
        <span className="eyebrow">
          {staff ? "สวัสดี" : "ยินดีต้อนรับกลับมา"}
        </span>
        <h1>{title || "ระบบติดตามทุนการศึกษา"}</h1>
        <h3>{text || "ระบบติดตามทุนการศึกษา"}</h3>
        <p>
          มาร่วมค้นหาโอกาสดี ๆ เพื่อพัฒนาตนเอง เพิ่มศักยภาพ
          และสร้างอนาคตที่ดีกว่าไปด้วยกัน
        </p>
      </div>
    </section>
  );
}
export function Stats({ staff = false }: { staff?: boolean }) {
  const values = staff
    ? ["12", "243", "28", "56", "112", "47"]
    : ["12", "3", "4", "1"];
  const labels = staff
    ? [
        "ทุนที่เปิดอยู่",
        "ใบสมัครทั้งหมด",
        "รอตรวจเอกสาร",
        "อยู่ระหว่างพิจารณา",
        "อนุมัติแล้ว",
        "รอจ่ายทุน",
      ]
    : [
        "ทุนที่เปิดรับ",
        "ใบสมัครที่กำลังดำเนินการ",
        "ทุนใกล้ปิดรับ",
        "ทุนที่ได้รับ",
      ];
  const icons = ["cap", "file", "clock", "people", "check", "money"];
  return (
    <div className={`stats ${staff ? "six" : ""}`}>
      {values.map((v, i) => (
        <Link
          key={i}
          className="stat panel"
          href={
            staff
              ? i === 0
                ? "/staff/scholarships"
                : "/staff/review"
              : i === 0 || i === 2
                ? "/scholarships"
                : "/applications"
          }
        >
          <span className={`stat-icon tint-${i}`}>
            <Icon name={icons[i]} size={31} />
          </span>
          <div>
            <small>{labels[i]}</small>
            <strong>
              {v}
              <span>รายการ</span>
            </strong>
          </div>
          <span>›</span>
        </Link>
      ))}
    </div>
  );
}
export function Timeline({ tracking = false }: { tracking?: boolean }) {
  const labels = tracking
    ? [
        "ร่างใบสมัคร",
        "ยืนยันใบสมัคร",
        "ตรวจสอบเอกสาร",
        "อยู่ระหว่างพิจารณา",
        "สัมภาษณ์ (ถ้ามี)",
        "ประกาศผล",
        "จ่ายทุน",
      ]
    : [
        "เปิดรับสมัครทุนพัฒนาทักษะดิจิทัล",
        "ปิดรับสมัครทุนส่งเสริมผลการเรียนดี",
        "ประกาศผลการพิจารณา (รอบที่ 1)",
        "สิ้นสุดการยืนยันสิทธิ์",
      ];
  return (
    <ol className="timeline">
      {labels.map((s, i) => (
        <li
          key={s}
          className={
            i < (tracking ? 3 : 1)
              ? "done"
              : i === (tracking ? 3 : 1)
                ? "current"
                : ""
          }
        >
          <span className="timeline-dot">
            {i < (tracking ? 3 : 1) ? "✓" : ""}
          </span>
          <div>
            {!tracking && (
              <time>
                {[15, 30, 15, 31][i]} {i < 2 ? "เม.ย." : "พ.ค."} 2568
              </time>
            )}
            <strong>{s}</strong>
            {tracking && (
              <p>
                {i < 3
                  ? "ดำเนินการเรียบร้อยแล้ว"
                  : i === 3
                    ? "คณะกรรมการกำลังพิจารณาใบสมัครของคุณ"
                    : "จะแจ้งกำหนดการให้ทราบภายหลัง"}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
export function Donut({ staff = false }: { staff?: boolean }) {
  return (
    <div className="chart-wrap">
      <div
        className="donut"
        role="img"
        aria-label={
          staff
            ? "สถิติใบสมัครตัวอย่างทั้งหมด 243 รายการ"
            : "สถิติใบสมัครตัวอย่างทั้งหมด 5 รายการ"
        }
      >
        <div>
          ทั้งหมด<strong>{staff ? "243" : "5"}</strong>รายการ
        </div>
      </div>
      <ul className="legend">
        {[
          "ผ่านการคัดเลือก",
          "อยู่ระหว่างพิจารณา",
          "รอเอกสารเพิ่มเติม",
          "ไม่ได้รับการคัดเลือก",
        ].map((x, i) => (
          <li key={x}>
            <i
              style={{
                background: ["#5aa679", "#4b95e8", "#ffcf67", "#aeb7c4"][i],
              }}
            />
            {x}
            <span>{(staff ? [112, 56, 28, 47] : [1, 3, 1, 0])[i]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
export function Quote() {
  return (
    <aside className="quote">
      “ การศึกษา คือการลงทุน
      <br />
      ที่คุ้มค่าที่สุดในชีวิต ”
      <small>
        มหาวิทยาลัยของเรา
        <br />
        เพื่ออนาคตที่ดีกว่าของทุกคน
      </small>
    </aside>
  );
}
export function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="notice" role="status">
      {children}
    </div>
  );
}
export function PageDirectory() {
  return (
    <>
      <Heading
        title="หน้าจอระบบติดตามทุนการศึกษา"
        description="เลือกดูหน้าสำหรับนักศึกษา เจ้าหน้าที่ และกรรมการ"
      />
      <div className="directory">
        {screens.map(([url, title], i) => (
          <Link className="panel" href={url} key={url}>
            <span>{String(i + 1).padStart(2, "0")}</span>
            <h2>{title}</h2>
            <Icon name="arrow" />
          </Link>
        ))}
      </div>
    </>
  );
}
