import Link from "next/link";
import { thaiDate, type ApplicationDocument, type ApplicationDocumentVersion } from "@/lib/scholarships/types";

const statusLabels = { pending: "รอตรวจ", verified: "ผ่านการตรวจ", revision_required: "ขอแก้ไข" } as const;

export default function DocumentVersionHistory({ document, versions }: {
  document: ApplicationDocument;
  versions: ApplicationDocumentVersion[];
}) {
  if (!versions.length) return null;
  return <details className="workflow-document-history">
    <summary>ประวัติเอกสาร {versions.length} เวอร์ชัน</summary>
    <ol>
      {versions.map((version) => <li key={version.id}>
        <Link href={`/documents/versions/${version.id}`}>เวอร์ชัน {version.revision_no}: {version.file_name}</Link>
        {version.revision_no === document.revision_no && <strong> · ปัจจุบัน</strong>}
        <span> · {thaiDate(version.uploaded_at, true)} · {statusLabels[version.status]}</span>
        {version.feedback && <p>ผลตรวจ: {version.feedback}</p>}
      </li>)}
    </ol>
  </details>;
}
