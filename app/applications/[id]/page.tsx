import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/server";
import { getStudentApplicationDetail } from "@/lib/scholarships/server";
import { applicationStatusLabels, money, thaiDate, type ApplicationStatus } from "@/lib/scholarships/types";
import { ApplicationStatusBadge } from "@/components/workflow/StatusBadge";
import { StudentAppealForm } from "@/components/workflow/WorkflowExtensions";
import DocumentVersionHistory from "@/components/workflow/DocumentVersionHistory";

const interviewStatus = { scheduled: "นัดหมายแล้ว", completed: "สัมภาษณ์แล้ว", cancelled: "ยกเลิก", no_show: "ไม่มาตามนัด" } as const;
const appealStatus = { pending: "รอพิจารณา", upheld: "รับอุทธรณ์", rejected: "ยกคำอุทธรณ์" } as const;

export default async function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["student"]);
  const { id } = await params;
  const detail = await getStudentApplicationDetail(id);
  if (!detail) notFound();
  const { application, scholarship, documents, documentVersions, paymentAccount, disbursement, history, interview, appeal } = detail;
  const statusLabel = (status: string) => applicationStatusLabels[status as ApplicationStatus] ?? status;
  const canAppeal = !appeal && ["reserve", "rejected"].includes(application.status) && Boolean(scholarship.results_published_at) && Boolean(scholarship.appeal_deadline);

  return <div className="workflow-stack">
    <section className="panel workflow-heading"><div><span className="workflow-eyebrow">APPLICATION #{application.application_no}</span><h1>{scholarship.title}</h1><p>ยื่นใบสมัคร {application.submitted_at ? thaiDate(application.submitted_at, true) : "ยังไม่ได้ส่ง"}</p></div><ApplicationStatusBadge status={application.status}/></section>
    {["draft", "revision_requested"].includes(application.status) && <section className="panel workflow-info">คุณยังแก้ไขใบสมัครได้ <Link href={`/apply?scholarship=${scholarship.id}`}>กลับไปแก้ไขใบสมัคร</Link></section>}
    {interview && <section className="panel"><h2>นัดสัมภาษณ์</h2><div className="workflow-facts"><div><span>วันและเวลา</span><strong>{thaiDate(interview.scheduled_at, true)}</strong></div><div><span>สถานะ</span><strong>{interviewStatus[interview.status]}</strong></div><div><span>สถานที่ / ช่องทาง</span><strong>{interview.location}</strong></div></div>{interview.meeting_url && <p><a className="btn secondary" href={interview.meeting_url} target="_blank" rel="noreferrer">เปิดลิงก์สัมภาษณ์ออนไลน์</a></p>}{interview.note && <p className="workflow-preserve">{interview.note}</p>}</section>}
    <section className="panel" id="document-history"><h2>เอกสารประกอบ</h2><div className="workflow-row-list">{documents.map((document) => <div key={document.id}><Link href={`/documents/${document.id}`}><span><strong>{document.requirement?.label ?? "เอกสาร"}</strong><small>{document.file_name}{document.feedback ? ` · ${document.feedback}` : ""}</small></span><span className={`document-state ${document.status}`}>{document.status === "verified" ? "ผ่านการตรวจ" : document.status === "revision_required" ? "ขอแก้ไข" : "รอตรวจ"}</span></Link><DocumentVersionHistory document={document} versions={documentVersions.filter((version) => version.document_id === document.id)}/></div>)}</div></section>
    <section className="panel"><h2>ข้อมูลบัญชีรับเงิน</h2>{paymentAccount ? <div className="workflow-facts"><div><span>ธนาคาร</span><strong>{paymentAccount.bank_name}</strong></div><div><span>ชื่อบัญชี</span><strong>{paymentAccount.account_holder}</strong></div><div><span>เลขบัญชี</span><strong>{paymentAccount.account_number}</strong></div></div> : <p>ยังไม่ได้ระบุข้อมูลบัญชี</p>}</section>
    {disbursement && <section className="panel"><h2>สถานะการจ่ายทุน</h2><div className="workflow-facts"><div><span>จำนวนเงิน</span><strong>{money(disbursement.amount)} บาท</strong></div><div><span>สถานะ</span><strong>{disbursement.status === "paid" ? "จ่ายแล้ว" : disbursement.status === "failed" ? "โอนไม่สำเร็จ" : "รอดำเนินการ"}</strong></div>{disbursement.transfer_date && <div><span>วันที่โอน</span><strong>{thaiDate(disbursement.transfer_date)}</strong></div>}{disbursement.transfer_reference && <div><span>เลขอ้างอิง</span><strong>{disbursement.transfer_reference}</strong></div>}</div>{disbursement.proof_path && <p><Link className="btn secondary" href={`/disbursements/${disbursement.id}/proof`}>ดาวน์โหลดหลักฐานการโอน</Link></p>}</section>}
    {(appeal || canAppeal) && <section className="panel"><h2>อุทธรณ์ผลการพิจารณา</h2>{appeal ? <div className="workflow-info"><strong>สถานะ: {appealStatus[appeal.status]}</strong><p className="workflow-preserve"><strong>เหตุผลที่ส่ง:</strong><br/>{appeal.reason}</p>{appeal.response && <p className="workflow-preserve"><strong>คำวินิจฉัย:</strong><br/>{appeal.response}</p>}</div> : <><p>ส่งคำอุทธรณ์ได้ถึง {thaiDate(scholarship.appeal_deadline!, true)}</p><StudentAppealForm applicationId={application.id}/></>}</section>}
    <section className="panel"><h2>ประวัติการดำเนินการ</h2><ol className="workflow-timeline">{history.map((entry) => <li key={entry.id}><time>{thaiDate(entry.created_at, true)}</time><strong>{entry.from_status ? `${statusLabel(entry.from_status)} → ${statusLabel(entry.to_status)}` : statusLabel(entry.to_status)}</strong>{entry.reason && <p>{entry.reason}</p>}</li>)}</ol></section>
    <div className="workflow-actions"><Link className="btn secondary" href="/applications">กลับรายการใบสมัคร</Link></div>
  </div>;
}
