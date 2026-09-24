import Link from "next/link";
import { applicationSteps } from "@/lib/steps/data";

export const metadata = {
  title: "ขั้นตอนการสมัครทุน",
  description: "ขั้นตอนทั้งหมดในการสมัครขอรับทุนการศึกษา มหาวิทยาลัยวลัยลักษณ์",
};

export default function StepsPage() {
  return (
    <div className="workflow-stack">
      <style>{`
        .step-timeline {
          display: flex;
          flex-direction: column;
          gap: 0;
          position: relative;
          margin-top: 12px;
        }

        .step-item {
          display: flex;
          gap: 20px;
          position: relative;
        }

        /* เส้นแนวตั้งเชื่อมโยงขั้นตอน */
        .step-rail {
          display: flex;
          flex-direction: column;
          align-items: center;
          flex-shrink: 0;
          width: 52px;
        }

        .step-circle {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: linear-gradient(135deg, #1b7352 0%, #0e563b 100%);
          color: #ffffff;
          font-weight: 800;
          font-size: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 3px 8px rgba(14, 86, 59, 0.25);
          z-index: 2;
          flex-shrink: 0;
        }

        .step-line {
          width: 3px;
          flex: 1;
          background: #d4e3dc;
          margin: 6px 0;
          border-radius: 2px;
          min-height: 24px;
        }

        /* การ์ดขั้นตอน */
        .step-card {
          flex: 1;
          min-width: 0;
          background: #ffffff;
          border: 1px solid #dbe5ee;
          border-radius: 12px;
          padding: 22px 24px;
          margin-bottom: 20px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }

        .step-card:hover {
          border-color: #62a27d;
          box-shadow: 0 4px 14px rgba(20, 33, 94, 0.06);
        }

        .step-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          flex-wrap: wrap;
        }

        .step-title-wrap {
          display: flex;
          flex-direction: column;
          gap: 6px;
          min-width: 0;
        }

        .step-badge {
          display: inline-flex;
          align-items: center;
          align-self: flex-start;
          font-size: 12px;
          font-weight: 700;
          color: #1f6047;
          background: #e7f6ed;
          padding: 3px 10px;
          border-radius: 999px;
        }

        .step-title {
          margin: 0;
          font-size: 20px;
          color: #14215e;
          font-weight: 700;
          overflow-wrap: anywhere;
          word-break: break-word;
        }

        .step-category-tag {
          display: inline-flex;
          align-items: center;
          font-size: 12px;
          font-weight: 600;
          color: #3b516f;
          background: #eef3f8;
          padding: 5px 12px;
          border-radius: 999px;
          white-space: nowrap;
        }

        .step-description {
          margin: 0;
          color: #4b5d73;
          font-size: 14px;
          line-height: 1.65;
          overflow-wrap: anywhere;
          word-break: break-word;
        }

        .step-facts-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 10px;
          background: #f8fafc;
          border: 1px solid #edf2f7;
          border-radius: 8px;
          padding: 12px 14px;
          margin: 2px 0 0;
        }

        .step-facts-grid div {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .step-facts-grid dt {
          font-size: 11px;
          color: #64748b;
          font-weight: 600;
        }

        .step-facts-grid dd {
          margin: 0;
          font-size: 13px;
          font-weight: 700;
          color: #1e293b;
          overflow-wrap: anywhere;
          word-break: break-word;
        }

        .step-actions {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 12px;
          margin-top: 4px;
        }

        @media (max-width: 640px) {
          .step-item {
            gap: 12px;
          }
          .step-rail {
            width: 36px;
          }
          .step-circle {
            width: 36px;
            height: 36px;
            font-size: 16px;
          }
          .step-card {
            padding: 16px;
            margin-bottom: 14px;
          }
          .step-title {
            font-size: 17px;
          }
          .step-facts-grid {
            grid-template-columns: 1fr;
          }
          .step-actions {
            justify-content: stretch;
          }
          .step-actions .btn {
            width: 100%;
          }
        }
      `}</style>

      <section className="workflow-heading panel">
        <div>
          <span className="workflow-eyebrow">APPLICATION GUIDE</span>
          <h1>ขั้นตอนทั้งหมดในการสมัครทุน</h1>
          <p>
            ศึกษาขั้นตอนและแนวทางการปฏิบัติในการสมัครขอรับทุนการศึกษา มหาวิทยาลัยวลัยลักษณ์
            ตั้งแต่การเตรียมตัว การกรอกข้อมูล การสัมภาษณ์ จนถึงการรับเงินทุน
          </p>
        </div>
      </section>

      {/* =========================
          ลำดับขั้นตอนแบบขั้นลงมา (Vertical Timeline)
          ========================= */}
      <section className="step-timeline" aria-label="ลำดับขั้นตอนการสมัครทุน">
        {applicationSteps.map((item, index) => {
          const isLast = index === applicationSteps.length - 1;
          return (
            <div className="step-item" key={item.id}>
              <div className="step-rail">
                <div className="step-circle" aria-label={`ขั้นตอนที่ ${item.stepNumber}`}>
                  {item.stepNumber}
                </div>
                {!isLast && <div className="step-line" aria-hidden="true" />}
              </div>

              <article className="step-card">
                <div className="step-header">
                  <div className="step-title-wrap">
                    <span className="step-badge">ขั้นตอนที่ {item.stepNumber}</span>
                    <h2 className="step-title">{item.title}</h2>
                  </div>
                  <span className="step-category-tag">{item.categoryLabel}</span>
                </div>

                <p className="step-description">{item.description}</p>

                <dl className="step-facts-grid">
                  <div>
                    <dt>ระยะเวลาโดยประมาณ</dt>
                    <dd>{item.timeEstimate}</dd>
                  </div>
                  <div>
                    <dt>กิจกรรมหลัก</dt>
                    <dd>{item.actionSummary}</dd>
                  </div>
                  <div>
                    <dt>สิ่งที่ต้องเตรียม</dt>
                    <dd>{item.requiredDocsSummary}</dd>
                  </div>
                  <div>
                    <dt>ช่องทางดำเนินการ</dt>
                    <dd>{item.channel}</dd>
                  </div>
                </dl>

                <div className="step-actions">
                  <Link className="btn secondary" href={`/steps/${item.id}`}>
                    ดูรายละเอียดขั้นตอน →
                  </Link>
                </div>
              </article>
            </div>
          );
        })}
      </section>
    </div>
  );
}
