"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { thaiDate, type ApplicationDocument, type ApplicationDocumentVersion } from "@/lib/scholarships/types";

const statusLabels = { pending: "รอตรวจ", verified: "ผ่านการตรวจ", revision_required: "ขอแก้ไข" } as const;

const pageSize = 20;

type VersionResponse = {
  versions?: ApplicationDocumentVersion[];
  nextCursor?: string | null;
};

export default function DocumentVersionHistory({ document }: { document: ApplicationDocument }) {
  const [versions, setVersions] = useState<ApplicationDocumentVersion[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const loadVersions = useCallback(async (cursor?: string | null) => {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const params = new URLSearchParams({ limit: String(pageSize) });
      if (cursor) params.set("before", cursor);
      const response = await fetch(`/api/documents/${document.id}/versions?${params.toString()}`, { cache: "no-store" });
      const payload = await response.json() as VersionResponse;
      if (!response.ok) throw new Error("โหลดประวัติเวอร์ชันไม่สำเร็จ");
      setVersions((current) => cursor ? [...current, ...(payload.versions ?? [])] : (payload.versions ?? []));
      setNextCursor(payload.nextCursor ?? null);
      setLoaded(true);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "โหลดประวัติเวอร์ชันไม่สำเร็จ");
    } finally {
      setPending(false);
    }
  }, [document.id, pending]);

  const handleToggle = (event: React.SyntheticEvent<HTMLDetailsElement>) => {
    if (event.currentTarget.open && !loaded && !pending) void loadVersions();
  };

  return <details className="workflow-document-history" onToggle={handleToggle}>
    <summary>ดูประวัติเวอร์ชันเอกสาร</summary>
    {pending && !versions.length && <p className="workflow-muted">กำลังโหลดประวัติ…</p>}
    {error && <p role="alert" className="workflow-error">{error}</p>}
    {loaded && !versions.length && !error && <p className="workflow-muted">ยังไม่มีประวัติเวอร์ชัน</p>}
    {!!versions.length && <>
      <ol>
        {versions.map((version) => <li key={version.id}>
          <Link href={`/documents/versions/${version.id}`}>เวอร์ชัน {version.revision_no}: {version.file_name}</Link>
          {version.revision_no === document.revision_no && <strong> · ปัจจุบัน</strong>}
          <span> · {thaiDate(version.uploaded_at, true)} · {statusLabels[version.status]}</span>
          {version.feedback && <p>ผลตรวจ: {version.feedback}</p>}
        </li>)}
      </ol>
      {nextCursor && <button type="button" className="btn secondary" disabled={pending} onClick={() => void loadVersions(nextCursor)}>
        {pending ? "กำลังโหลด…" : "ดูเวอร์ชันเพิ่มเติม"}
      </button>}
    </>}
  </details>;
}
