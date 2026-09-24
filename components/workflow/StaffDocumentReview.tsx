"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { reviewApplicationDocuments, type WorkflowState } from "@/app/actions/scholarships";
import type { ApplicationDocument, ApplicationSummary } from "@/lib/scholarships/types";
import DocumentVersionHistory from "./DocumentVersionHistory";

const empty: WorkflowState = { error: "", success: "" };
type ReviewRow = { id: string; version: number; status: ApplicationDocument["status"]; feedback: string };

export default function StaffDocumentReview({ application, documents }: {
  application: ApplicationSummary;
  documents: ApplicationDocument[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState<ReviewRow[]>(() => documents.map((item) => ({
    id: item.id, version: item.version, status: item.status, feedback: item.feedback ?? "",
  })));
  const [state, action, pending] = useActionState(reviewApplicationDocuments, empty);
  useEffect(() => { if (state.success) router.refresh(); }, [router, state.success]);
  const canReview = ["submitted", "revision_requested"].includes(application.status);
  const waiting = rows.some((row) => row.status === "pending");
  const missingFeedback = rows.some((row) => row.status === "revision_required" && row.feedback.trim().length < 3);
  const hasRevision = rows.some((row) => row.status === "revision_required");

  return <section className="panel">
    <h2>เอกสารประกอบ</h2>
    <form action={action} className="workflow-form" onInvalidCapture={(event) => event.currentTarget.classList.add("form-validated")}>
      <input type="hidden" name="application_id" value={application.id}/>
      <input type="hidden" name="version" value={application.version}/>
      <input type="hidden" name="documents" value={JSON.stringify(rows)}/>
      {documents.length ? <div className="workflow-document-list">
        {documents.map((item, index) => <article className="workflow-document" key={item.id}>
          <div>
            <strong>{item.requirement?.label ?? "เอกสาร"}</strong>
            <p><Link href={`/documents/${item.id}`}>{item.file_name}</Link> · เวอร์ชัน {item.revision_no}</p>
            <DocumentVersionHistory document={item}/>
          </div>
          <div className="workflow-document-review">
            <select aria-label={`ผลตรวจ ${item.requirement?.label ?? item.file_name}`} value={rows[index]?.status ?? "pending"} disabled={!canReview}
              onChange={(event) => setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, status: event.target.value as ReviewRow["status"] } : row))}>
              <option value="pending">รอตรวจ</option><option value="verified">ผ่านการตรวจ</option><option value="revision_required">ขอแก้ไข</option>
            </select>
            <input aria-label={`เหตุผลการตรวจ ${item.requirement?.label ?? item.file_name}`}
              value={rows[index]?.feedback ?? ""} maxLength={2000} disabled={!canReview}
              required={rows[index]?.status === "revision_required"}
              minLength={rows[index]?.status === "revision_required" ? 3 : undefined}
              placeholder="เหตุผลเฉพาะเอกสารที่ขอแก้ไข"
              onChange={(event) => setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, feedback: event.target.value } : row))}/>
          </div>
        </article>)}
      </div> : <p>ทุนนี้ไม่มีเอกสารที่ต้องตรวจ</p>}
      {canReview && <>
        {waiting && <p className="workflow-muted">กรุณาเลือกผลตรวจให้ครบทุกเอกสารก่อนบันทึก</p>}
        {missingFeedback && <p className="workflow-error">เอกสารที่ขอแก้ไขต้องมีเหตุผลอย่างน้อย 3 ตัวอักษร</p>}
        <label>เหตุผล / ข้อความแจ้งนักศึกษา *
          <textarea name="reason" required minLength={3} maxLength={2000} rows={3} placeholder="สรุปผลการตรวจเอกสาร"/>
        </label>
        <div className="workflow-actions">
          <button className="btn secondary" name="action" value="request_revision" disabled={pending || waiting || missingFeedback || !hasRevision} aria-busy={pending}>{pending && <span className="action-spinner" aria-hidden="true"/>}
            {pending ? "กำลังบันทึก…" : "ขอแก้ไขเอกสาร"}
          </button>
          <button className="btn" name="action" value="verify" disabled={pending || waiting || hasRevision} aria-busy={pending}>{pending && <span className="action-spinner" aria-hidden="true"/>}
            {pending ? "กำลังบันทึก…" : "ยืนยันเอกสารครบ"}
          </button>
        </div>
      </>}
      {state.error && <p role="alert" className="workflow-error">{state.error}</p>}
      {state.success && <p role="status" className="workflow-success"><span className="action-success-mark" aria-hidden="true">✓</span>{state.success}</p>}
    </form>
  </section>;
}
