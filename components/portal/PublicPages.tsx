import Link from "next/link";
import { Action, Icon, Panel } from "./Shared";
import type { ScholarshipSummary } from "@/lib/scholarships/types";
import { money, thaiDate } from "@/lib/scholarships/types";
import { homeForRole, type Viewer } from "@/lib/auth/types";
export function Landing({ scholarships, viewer, contact }: { scholarships: ScholarshipSummary[]; viewer: Viewer | null; contact: { department: string; phone: string; email: string; hours: string } }) {
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
        <div className="section-title">
          <h2 className="underlined">ทุนที่เปิดรับ</h2>
          <Link href="/scholarships">ดูทุนทั้งหมด →</Link>
        </div>
        <div className="landing-scholarships">
          {scholarships.filter((item) => item.status === "published").map((s, i) => (
            <article className={`landing-fund fund-${i % 3}`} key={s.id}>
              <div className="section-title">
                <span className="feature-icon">
                  <Icon name={["trophy", "money", "people"][i % 3]} size={30} />
                </span>
                <div>
                  <h3>{s.title}</h3>
                  <p>{s.description}</p>
                </div>
                <Link className="btn secondary" href={`/scholarships/${s.id}`}>
                  ดูรายละเอียด →
                </Link>
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
            </article>
          ))}
          {!scholarships.some((item) => item.status === "published") && <Panel><h3>ยังไม่มีทุนที่เปิดรับ</h3><p>กรุณาตรวจสอบประกาศอีกครั้งภายหลัง หรือติดต่อเจ้าหน้าที่ทุน</p></Panel>}
        </div>
        <div className="columns home-lower">
          <Panel
            title="ขั้นตอนการสมัคร"
            action={<Link href="/steps">ดูขั้นตอนแบบละเอียด →</Link>}
          >
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
          <Panel title="ติดต่อเจ้าหน้าที่" action={<Link href="/contact">ดูข้อมูลการติดต่อและแผนที่ →</Link>}>
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
