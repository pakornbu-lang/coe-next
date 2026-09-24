import Link from "next/link";
import { Action, Icon, Panel } from "./Shared";
import type { ScholarshipWithRequirements } from "@/lib/scholarships/server";
import { getScholarshipTimeState, money, thaiDate } from "@/lib/scholarships/types";
import { homeForRole, type Viewer } from "@/lib/auth/types";

const programLabels: Record<string, string> = {
  academic: "ผลการเรียนดี",
  financial_need: "ขาดแคลนทุนทรัพย์",
  activity: "กิจกรรมและความเป็นผู้นำ",
  talent: "ความสามารถพิเศษ",
  research: "วิจัยและนวัตกรรม",
  emergency: "ฉุกเฉิน",
  general: "ทั่วไป",
};
const programIcons: Record<string, string> = {
  academic: "chart",
  financial_need: "money",
  activity: "people",
  talent: "star",
  research: "file",
  emergency: "bell",
  general: "bookmark",
};

export function Landing({
  scholarships,
  totalScholarships,
  viewer,
  contact,
}: {
  scholarships: ScholarshipWithRequirements[];
  totalScholarships: number;
  viewer: Viewer | null;
  contact: { department: string; phone: string; email: string; hours: string };
}) {
  // The page is rendered on the server, so all cards use the same timestamp.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const openScholarships = scholarships.filter((item) => getScholarshipTimeState(item, now) === "open");
  const upcomingScholarships = scholarships.filter((item) => getScholarshipTimeState(item, now) === "upcoming");
  const closedScholarships = scholarships.filter((item) => getScholarshipTimeState(item, now) === "closed");
  const closingSoon = openScholarships.filter((item) => {
    const days = (new Date(item.closes_at).getTime() - now) / 86_400_000;
    return days >= 0 && days <= 7;
  }).slice(0, 3);
  const categoryStats = Object.keys(programLabels).map((kind) => ({
    kind,
    label: programLabels[kind],
    count: scholarships.filter((item) => item.program_kind === kind).length,
  }));

  return (
    <>
      <section className="hero">
        <div className="hero-inner">
          <span className="badge">
            <Icon name="cap" size={19} />
            เฉพาะทุนภายในมหาวิทยาลัย
          </span>
          <h1>
            ระบบติดตามทุนการศึกษา
            <br />
            ภายในมหาวิทยาลัย
          </h1>
          <p>
            เปิดโอกาสให้นักศึกษาเข้าถึงทุนการศึกษาของมหาวิทยาลัย
            <br />
            เพื่อพัฒนาศักยภาพ และก้าวสู่อนาคตที่ดียิ่งขึ้น
          </p>
          <div className="button-row">
            <Action href="/scholarships">
              <Icon name="search" />
              ดูทุนที่เปิดรับ
            </Action>
            <Action href={viewer ? homeForRole(viewer.role) : "/login"} secondary>
              <Icon name="arrow" />
              {viewer ? "ไปหน้าหลักของฉัน" : "เข้าสู่ระบบ"}
            </Action>
          </div>
        </div>
      </section>
      <div className="landing-content">
        <section className="landing-overview" aria-label="สรุปทุนการศึกษา">
          <div>
            <span>ทุนทั้งหมด</span>
            <strong>{totalScholarships}</strong>
            <small>รายการทุนในระบบ</small>
          </div>
          <div>
            <span>กำลังเปิดรับสมัคร</span>
            <strong>{openScholarships.length}</strong>
            <small>ทุนที่สมัครได้ตอนนี้</small>
          </div>
          <div>
            <span>กำลังจะเปิดรับ</span>
            <strong>{upcomingScholarships.length}</strong>
            <small>ทุนที่เตรียมเปิดสมัคร</small>
          </div>
          <div>
            <span>ปิดรับสมัครแล้ว</span>
            <strong>{closedScholarships.length}</strong>
            <small>ดูประกาศและรายละเอียดย้อนหลัง</small>
          </div>
          <Link className="landing-overview-link" href="/scholarships">
            ดูทุนทั้งหมด <span aria-hidden="true">→</span>
          </Link>
        </section>
        <div className="section-title">
          <div>
            <h2 className="underlined">ทุนที่เปิดรับสมัครตอนนี้</h2>
            <p className="landing-section-lead">เลือกทุนที่ตรงกับคุณ ตรวจเอกสารที่ต้องใช้ และกดสมัครได้จากการ์ดนี้ทันที</p>
          </div>
          <Link href="/scholarships?status=open">ดูทุนที่เปิดทั้งหมด →</Link>
        </div>
        <div className="landing-scholarships">
          {openScholarships.slice(0, 6).map((s, i) => {
            const requiredDocuments = s.requirements.filter((item) => item.required);
            return (
              <article className={`landing-fund fund-${i % 3}`} key={s.id}>
                <div className="landing-fund-heading">
                  <span className="feature-icon">
                    <Icon name={["trophy", "money", "people"][i % 3]} size={30} />
                  </span>
                  <div>
                    <span className="landing-status">เปิดรับสมัคร</span>
                    <h3>{s.title}</h3>
                    <p>{s.description || "ดูรายละเอียดคุณสมบัติและเงื่อนไขการสมัคร"}</p>
                  </div>
                </div>
                <div className="fund-metrics">
                  <span>
                    <Icon name="money" />
                    จำนวนเงิน<strong>{money(s.amount)} บาท</strong>
                  </span>
                  <span>
                    <Icon name="people" />
                    จำนวนรับ<strong>{s.quota} คน</strong>
                  </span>
                  <span>
                    <Icon name="calendar" />
                    ปิดรับสมัคร<strong>{thaiDate(s.closes_at, true)}</strong>
                  </span>
                </div>
                <div className="landing-fund-meta">
                  <span>ประเภททุน: {programLabels[s.program_kind] ?? "ทั่วไป"}</span>
                  {s.minimum_gpa !== null && <span>GPA ขั้นต่ำ {s.minimum_gpa.toFixed(2)}</span>}
                </div>
                <div className="landing-documents">
                  <strong><Icon name="file" size={18} /> เอกสารที่ต้องใช้</strong>
                  {requiredDocuments.length ? (
                    <ul>
                      {requiredDocuments.slice(0, 4).map((document) => (
                        <li key={document.id}><Icon name="check" size={15} />{document.label}</li>
                      ))}
                      {requiredDocuments.length > 4 && <li className="landing-more-documents">และอีก {requiredDocuments.length - 4} รายการ</li>}
                    </ul>
                  ) : (
                    <p>ดูรายการเอกสารในหน้ารายละเอียดทุน</p>
                  )}
                </div>
                <div className="landing-fund-actions">
                  <Link className="btn" href={`/apply?scholarship=${s.id}`}>
                    สมัครทุน <Icon name="arrow" size={18} />
                  </Link>
                  <Link className="btn secondary" href={`/scholarships/${s.id}`}>
                    ดูรายละเอียด
                  </Link>
                </div>
              </article>
            );
          })}
          {!openScholarships.length && (
            <Panel className="landing-empty-open">
              <h3>ขณะนี้ยังไม่มีทุนที่เปิดรับสมัคร</h3>
              <p>ดูทุนที่กำลังจะเปิดหรือประกาศทุนที่ปิดรับสมัครแล้วได้จากรายการทุนทั้งหมด</p>
              <Link className="btn secondary" href="/scholarships">ดูรายการทุนทั้งหมด</Link>
            </Panel>
          )}
        </div>
        {closedScholarships.length > 0 && (
          <section className="landing-closed-section" aria-labelledby="closed-scholarships-title">
            <div className="section-title">
              <div>
                <h2 id="closed-scholarships-title" className="underlined">ทุนที่ปิดรับสมัครแล้ว</h2>
                <p className="landing-section-lead">ตรวจสอบประกาศและรายละเอียดทุนย้อนหลังได้ที่นี่</p>
              </div>
              <Link href="/scholarships?status=closed">ดูทั้งหมด →</Link>
            </div>
            <div className="landing-closed-list">
              {closedScholarships.slice(0, 3).map((item) => (
                <Link className="landing-closed-card" href={`/scholarships/${item.id}`} key={item.id}>
                  <span>
                    <strong>{item.title}</strong>
                    <small>{programLabels[item.program_kind] ?? "ทั่วไป"}</small>
                  </span>
                  <span className="landing-closed-date">ปิดรับ {thaiDate(item.closes_at, true)} <span aria-hidden="true">→</span></span>
                </Link>
              ))}
            </div>
          </section>
        )}
        {closingSoon.length > 0 && (
          <section className="landing-closing-soon" aria-labelledby="closing-soon-title">
            <div className="section-title">
              <div>
                <h2 id="closing-soon-title" className="underlined">ทุนใกล้ปิดรับสมัคร</h2>
                <p className="landing-section-lead">เหลือเวลาไม่เกิน 7 วัน ควรเตรียมเอกสารและสมัครโดยเร็ว</p>
              </div>
              <Link href="/scholarships?status=open">ดูทุนที่เปิดทั้งหมด →</Link>
            </div>
            <div className="landing-closing-list">
              {closingSoon.map((item) => (
                <Link className="landing-closing-card" href={`/apply?scholarship=${item.id}`} key={item.id}>
                  <span className="landing-closing-icon"><Icon name="clock" size={22} /></span>
                  <span className="landing-closing-copy">
                    <strong>{item.title}</strong>
                    <small>ปิดรับสมัคร {thaiDate(item.closes_at, true)}</small>
                  </span>
                  <span className="landing-closing-action">สมัครทุน <span aria-hidden="true">→</span></span>
                </Link>
              ))}
            </div>
          </section>
        )}
        <section className="landing-category-section" aria-labelledby="category-title">
          <div className="section-title">
            <div>
              <h2 id="category-title" className="underlined">ประเภททุน</h2>
              <p className="landing-section-lead">เลือกดูทุนตามเป้าหมายและความสนใจของคุณ</p>
            </div>
            <Link href="/scholarships">ค้นหาทุนทั้งหมด →</Link>
          </div>
          <div className="landing-category-grid">
            {categoryStats.map((category) => (
              <Link className="landing-category-card" href="/scholarships" key={category.kind}>
                <span className="landing-category-icon"><Icon name={programIcons[category.kind]} size={22} /></span>
                <span>
                  <strong>{category.label}</strong>
                  <small>{category.count} รายการในหน้าแรก</small>
                </span>
                <span className="landing-category-arrow" aria-hidden="true">→</span>
              </Link>
            ))}
          </div>
        </section>
        <div className="features">
          {[
            [
              "search",
              "ค้นหาทุนได้ง่าย",
              "ค้นหาทุนตามคุณสมบัติ คณะ หรือประเภททุนได้อย่างรวดเร็ว",
            ],
            [
              "file",
              "สมัครออนไลน์",
              "กรอกใบสมัครและอัปโหลดเอกสารได้ครบ จบในระบบเดียว",
            ],
            [
              "chart",
              "ติดตามผลในระบบ",
              "ตรวจสอบสถานะการสมัครและผลการพิจารณาได้ตลอดเวลา",
            ],
          ].map(([icon, title, text]) => (
            <Panel key={title}>
              <span className="feature-icon">
                <Icon name={icon} size={34} />
              </span>
              <div>
                <h2>{title}</h2>
                <p>{text}</p>
              </div>
            </Panel>
          ))}
        </div>
        <div className="columns home-lower">
          <Panel title="ขั้นตอนการสมัคร">
            <div id="steps" className="steps">
              {[
                ["search", "ค้นหาทุน", "เลือกทุนที่สนใจและตรวจสอบคุณสมบัติ"],
                [
                  "file",
                  "กรอกใบสมัคร",
                  "กรอกข้อมูลให้ครบถ้วนและตรวจสอบความถูกต้อง",
                ],
                ["upload", "อัปโหลดเอกสาร", "แนบเอกสารตามที่กำหนดในระบบ"],
                [
                  "check",
                  "ติดตามผล",
                  "ตรวจสอบสถานะการสมัครผ่านระบบได้ตลอดเวลา",
                ],
              ].map(([icon, title, text], i) => (
                <div key={title}>
                  <span className="step-number">{i + 1}</span>
                  <Icon name={icon} size={29} />
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              ))}
            </div>
          </Panel>
          <Panel title="สิ่งที่ควรเตรียม" className="prepare">
            <ul className="check-list">
              {[
                "ใบแสดงผลการศึกษา",
                "สำเนาบัตรประจำตัวนักศึกษา",
                "เอกสารรับรองรายได้ (ถ้ามี)",
                "เอกสารเพิ่มเติมตามประเภททุน",
              ].map((x) => (
                <li key={x}>
                  <Icon name="file" size={22} />
                  {x}
                </li>
              ))}
            </ul>
          </Panel>
        </div>
        <div className="three-columns">
          <Panel title="ประกาศล่าสุด">
            <ul id="news" className="news-list">
              {scholarships.slice(0, 3).map((item) => (
                <li key={item.id}>
                  <Link href={`/scholarships/${item.id}`}>{item.title}</Link>
                  <time>ปิดรับ {thaiDate(item.closes_at, true)}</time>
                </li>
              ))}
              {!scholarships.length && <li>ยังไม่มีประกาศทุนในระบบ</li>}
            </ul>
          </Panel>
          <Panel title="ติดต่อเจ้าหน้าที่">
            <div id="contact">
              <p>{contact.department}</p>
              {contact.phone && <p>☎ {contact.phone}</p>}
              {contact.email && <p>✉ <a href={`mailto:${contact.email}`}>{contact.email}</a></p>}
              <p>{contact.hours}</p>
              <small>ติดต่อผ่านช่องทางของมหาวิทยาลัยในเวลาทำการ</small>
            </div>
          </Panel>
          <Panel title="คำถามที่พบบ่อย">
            <div id="faq">
              {[
                [
                  "คุณสมบัติของผู้สมัครทุนคืออะไร",
                  "เป็นนักศึกษาปัจจุบันและมีคุณสมบัติตรงตามประกาศทุนแต่ละประเภท",
                ],
                [
                  "ต้องใช้เอกสารอะไรบ้าง",
                  "ใบแสดงผลการศึกษา บัตรนักศึกษา และเอกสารเพิ่มเติมตามประกาศทุน",
                ],
                [
                  "สามารถสมัครได้กี่ทุน",
                  "ตรวจสอบเงื่อนไขการรับทุนซ้ำซ้อนในรายละเอียดของแต่ละทุน",
                ],
              ].map(([q, a]) => (
                <details className="faq" key={q}>
                  <summary>{q}</summary>
                  <p>{a}</p>
                </details>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
