import type { Metadata } from "next";
import { Icon } from "@/components/portal/Shared";

export const metadata: Metadata = {
  title: "ติดต่อเจ้าหน้าที่",
  description: "ช่องทางการติดต่อเจ้าหน้าที่งานทุนการศึกษา มหาวิทยาลัยวลัยลักษณ์ พร้อมแผนที่และตำแหน่งที่ตั้ง",
};

export default function ContactPage() {
  const departmentName =
    process.env.NEXT_PUBLIC_SUPPORT_DEPARTMENT ||
    "งานทุนการศึกษา ส่วนส่งเสริมและพัฒนานักศึกษา มหาวิทยาลัยวลัยลักษณ์";
  const supportPhone =
    process.env.NEXT_PUBLIC_SUPPORT_PHONE || "0-7567-3000, 0-7567-3101";
  const supportEmail =
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "scholarship@wu.ac.th";
  const supportHours =
    process.env.NEXT_PUBLIC_SUPPORT_HOURS ||
    "วันจันทร์ – วันศุกร์ เวลา 08.30 – 16.30 น. (เว้นวันหยุดราชการ)";

  return (
    <div className="workflow-stack">
      <style>{`
        .contact-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          align-items: start;
        }

        .contact-card-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .contact-item-card {
          display: flex;
          gap: 16px;
          align-items: flex-start;
          padding: 16px 18px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
        }

        .contact-item-icon {
          flex-shrink: 0;
          width: 42px;
          height: 42px;
          border-radius: 10px;
          background: #e6f4ed;
          color: #1b7352;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .contact-item-content {
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 0;
        }

        .contact-item-content h3 {
          margin: 0;
          font-size: 15px;
          color: #14215e;
          font-weight: 700;
        }

        .contact-item-content p {
          margin: 0;
          font-size: 14px;
          color: #334155;
          line-height: 1.5;
          overflow-wrap: anywhere;
          word-break: break-word;
        }

        .contact-item-content a {
          color: #1b7352;
          text-decoration: underline;
          font-weight: 600;
        }

        .contact-map-wrapper {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .contact-map-frame {
          width: 100%;
          height: 400px;
          border: 1px solid #cbd5e1;
          border-radius: 12px;
          overflow: hidden;
          background: #e2e8f0;
        }

        .contact-map-frame iframe {
          width: 100%;
          height: 100%;
          border: 0;
          display: block;
        }

        .location-badge-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 10px;
          padding: 12px 16px;
          background: #f1f5f9;
          border-radius: 8px;
          font-size: 13px;
          color: #475569;
        }

        .location-badge-row strong {
          color: #0f172a;
        }

        @media (max-width: 900px) {
          .contact-grid {
            grid-template-columns: 1fr;
          }
          .contact-map-frame {
            height: 320px;
          }
        }
      `}</style>

      <section className="workflow-heading panel">
        <div>
          <span className="workflow-eyebrow">CONTACT US</span>
          <h1>ติดต่อเจ้าหน้าที่งานทุนการศึกษา</h1>
          <p>
            ช่องทางการติดต่อ สอบถามข้อมูลทุนการศึกษา และตำแหน่งที่ตั้งหน่วยงาน มหาวิทยาลัยวลัยลักษณ์
          </p>
        </div>
      </section>

      <div className="contact-grid">
        {/* คอลัมน์ซ้าย: ข้อมูลติดต่อและเวลาทำการ */}
        <section className="panel">
          <h2>ข้อมูลการติดต่อ</h2>
          <p style={{ margin: "4px 0 16px", color: "var(--muted)", fontSize: "14px" }}>
            หากมีข้อสงสัยเกี่ยวกับคุณสมบัติ การเตรียมเอกสาร หรือขั้นตอนการสมัครทุน สามารถติดต่อสอบถามเจ้าหน้าที่ได้ตามช่องทางด้านล่าง
          </p>

          <div className="contact-card-list">
            <div className="contact-item-card">
              <div className="contact-item-icon">
                <Icon name="home" size={20} />
              </div>
              <div className="contact-item-content">
                <h3>หน่วยงาน</h3>
                <p>{departmentName}</p>
                <p style={{ color: "#64748b", fontSize: "13px" }}>
                  อาคารกิจกรรมนักศึกษา มหาวิทยาลัยวลัยลักษณ์
                </p>
              </div>
            </div>

            <div className="contact-item-card">
              <div className="contact-item-icon">
                <Icon name="mail" size={20} />
              </div>
              <div className="contact-item-content">
                <h3>อีเมลติดต่อ</h3>
                <p>
                  <a href={`mailto:${supportEmail}`}>{supportEmail}</a>
                </p>
                <p style={{ color: "#64748b", fontSize: "13px" }}>
                  สามารถส่งข้อความสอบถามได้ตลอด 24 ชั่วโมง
                </p>
              </div>
            </div>

            <div className="contact-item-card">
              <div className="contact-item-icon">
                <Icon name="cap" size={20} />
              </div>
              <div className="contact-item-content">
                <h3>เบอร์โทรศัพท์</h3>
                <p>
                  <strong>{supportPhone}</strong>
                </p>
                <p style={{ color: "#64748b", fontSize: "13px" }}>
                  โทรศัพท์ติดต่อในวันและเวลาทำการ
                </p>
              </div>
            </div>

            <div className="contact-item-card">
              <div className="contact-item-icon">
                <Icon name="file" size={20} />
              </div>
              <div className="contact-item-content">
                <h3>เวลาทำการ</h3>
                <p>{supportHours}</p>
                <p style={{ color: "#64748b", fontSize: "13px" }}>
                  ปิดทำการในวันเสาร์ วันอาทิตย์ และวันหยุดนักขัตฤกษ์
                </p>
              </div>
            </div>
          </div>

          <div style={{ marginTop: "20px", padding: "14px 16px", background: "#fef9ee", border: "1px solid #f9e2af", borderRadius: "8px" }}>
            <h4 style={{ margin: "0 0 6px", color: "#8a5b00", fontSize: "14px" }}>📌 คำแนะนำสำหรับนักศึกษา</h4>
            <p style={{ margin: 0, fontSize: "13px", color: "#6c4800", lineHeight: "1.6" }}>
              เมื่อติดต่อสอบถามเกี่ยวกับใบสมัคร กรุณาแจ้ง <strong>รหัสนักศึกษา</strong> และ <strong>ชื่อทุนการศึกษา</strong> ที่ได้ยื่นสมัครไว้ เพื่อให้เจ้าหน้าที่ตรวจสอบสถานะได้อย่างรวดเร็ว
            </p>
          </div>
        </section>

        {/* คอลัมน์ขวา: แผนที่และตำแหน่งที่ตั้งมหาวิทยาลัยวลัยลักษณ์ */}
        <section className="panel contact-map-wrapper">
          <h2>ตำแหน่งที่ตั้ง (มหาวิทยาลัยวลัยลักษณ์)</h2>
          <p style={{ margin: "4px 0 12px", color: "var(--muted)", fontSize: "14px" }}>
            แผนที่แสดงตำแหน่งที่ตั้งของมหาวิทยาลัยวลัยลักษณ์ อ.ท่าศาลา จ.นครศรีธรรมราช
          </p>

          <div className="location-badge-row">
            <div>
              📍 <strong>มหาวิทยาลัยวลัยลักษณ์ (Walailak University)</strong>
            </div>
            <div>
              222 ต.ไทยบุรี อ.ท่าศาลา จ.นครศรีธรรมราช 80160
            </div>
          </div>

          {/* แผ่นแผนที่ Google Maps Embed */}
          <div className="contact-map-frame">
            <iframe
              title="แผนที่มหาวิทยาลัยวลัยลักษณ์"
              src="https://maps.google.com/maps?q=Walailak+University,+Nakhon+Si+Thammarat&t=&z=15&ie=UTF8&iwloc=&output=embed"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          </div>

          <div>
            <a
              className="btn"
              href="https://maps.google.com/?q=Walailak+University"
              target="_blank"
              rel="noopener noreferrer"
            >
              เปิดใน Google Maps ↗
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}
