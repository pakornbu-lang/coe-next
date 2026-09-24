import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getApplicationStep,
  applicationSteps,
} from "@/lib/steps/data";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const step = getApplicationStep(id);
  if (!step) return { title: "ไม่พบขั้นตอน" };
  return {
    title: `ขั้นตอนที่ ${step.stepNumber}: ${step.title}`,
  };
}

export default async function StepDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const step = getApplicationStep(id);
  if (!step) notFound();

  const prevStep =
    step.stepNumber > 1
      ? applicationSteps.find((s) => s.stepNumber === step.stepNumber - 1)
      : null;

  const nextStep =
    step.stepNumber < applicationSteps.length
      ? applicationSteps.find((s) => s.stepNumber === step.stepNumber + 1)
      : null;

  return (
    <div className="workflow-stack">
      <style>{`
        .step-detail-table {
          width: 100%;
          border-collapse: collapse;
        }

        .step-detail-table th,
        .step-detail-table td {
          padding: 12px 14px;
          text-align: left;
          border-bottom: 1px solid #e1e8ee;
          vertical-align: top;
          overflow-wrap: anywhere;
          word-break: break-word;
        }

        .step-detail-table th {
          background: #f8fafc;
          font-weight: 700;
          color: #1e293b;
        }

        .step-detail-table td strong {
          color: #14215e;
        }
      `}</style>

      <section className="panel workflow-heading">
        <div>
          <span className="workflow-eyebrow">
            STEP {step.stepNumber} DETAIL
          </span>
          <h1>ขั้นตอนที่ {step.stepNumber}: {step.title}</h1>
          <p>
            {step.description}
          </p>
        </div>
        <span className="workflow-status scholarship-published">
          ขั้นตอนที่ {step.stepNumber}
        </span>
      </section>

      <section className="panel">
        <div className="workflow-facts">
          <div>
            <span>ลำดับขั้นตอน</span>
            <strong>
              {step.stepNumber} จาก {applicationSteps.length}
            </strong>
          </div>
          <div>
            <span>หมวดหมู่</span>
            <strong>{step.categoryLabel}</strong>
          </div>
          <div>
            <span>ระยะเวลาโดยประมาณ</span>
            <strong>{step.timeEstimate}</strong>
          </div>
          <div>
            <span>ช่องทางดำเนินการ</span>
            <strong>{step.channel}</strong>
          </div>
        </div>

        <h2>รายละเอียดและวิธีปฏิบัติ</h2>
        <p className="workflow-preserve">
          {step.detailedDescription}
        </p>

        <h2>คำแนะนำและข้อควรระวัง</h2>
        <p className="workflow-preserve">
          {step.tipsAndWarnings}
        </p>
      </section>

      <section className="panel">
        <h2>เอกสารและสิ่งที่ต้องเตรียม</h2>
        <ul className="workflow-checklist">
          {step.requirements.map((item, idx) => (
            <li key={idx}>
              <strong>{item.label}</strong>
              {item.required && (
                <span className="required-mark">จำเป็น</span>
              )}
              <small>{item.details}</small>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <h2>ลำดับการปฏิบัติงานย่อย</h2>
        <div className="workflow-score-table">
          <table className="step-detail-table">
            <thead>
              <tr>
                <th style={{ width: "30%", minWidth: "120px" }}>ลำดับงาน</th>
                <th style={{ width: "70%" }}>วิธีปฏิบัติ</th>
              </tr>
            </thead>
            <tbody>
              {step.subtasks.map((task, idx) => (
                <tr key={idx}>
                  <td>
                    <strong>{task.name}</strong>
                  </td>
                  <td>{task.instruction}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="workflow-actions">
        <Link className="btn secondary" href="/steps">
          กลับรายการขั้นตอนทั้งหมด
        </Link>

        {prevStep && (
          <Link
            className="btn secondary"
            href={`/steps/${prevStep.id}`}
          >
            ← ขั้นตอนที่ {prevStep.stepNumber}: {prevStep.title}
          </Link>
        )}

        {nextStep && (
          <Link
            className="btn"
            href={`/steps/${nextStep.id}`}
          >
            ขั้นตอนที่ {nextStep.stepNumber}: {nextStep.title} →
          </Link>
        )}
      </div>
    </div>
  );
}
