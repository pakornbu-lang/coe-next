"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { readStudentNotification } from "@/app/actions/student-notifications";
import { readMemberNotification } from "@/app/actions/member-notifications";
import type { Notification } from "@/lib/scholarships/types";
import styles from "./StudentNotifications.module.css";

type Result = { items: Notification[]; unread: number; total: number; page: number };
export default function StudentNotifications({ compact = false, audience = "student" }: { compact?: boolean; audience?: "student" | "member" }) {
  const router = useRouter();
  const [data, setData] = useState<Result | null>(null);
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const request = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    try {
      const response = await fetch(`/api/${audience}/notifications?page=${page}&unread=${unreadOnly}`, {
        cache: "no-store", signal: controller.signal,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "โหลดข้อมูลไม่สำเร็จ");
      if (!controller.signal.aborted) { setData(result); setError(""); }
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [page, unreadOnly, audience]);
  useEffect(() => {
    const initialLoad = window.setTimeout(() => { void load(); }, 0);
    // Manual refresh avoids adding background database load.
    const changed = () => { void load(); };
    window.addEventListener("student-notifications-changed", changed);
    return () => {
      window.clearTimeout(initialLoad);
      request.current?.abort();
      window.removeEventListener("student-notifications-changed", changed);
    };
  }, [load]);
  async function mark(id?: string, href?: string) {
    if (busy) return;
    setBusy(true); setNotice("");
    try {
      const result = await (audience === "student" ? readStudentNotification(id) : readMemberNotification(id));
      if (result.error) { setError(result.error); return; }
      setNotice(id ? "เปลี่ยนเป็นอ่านแล้ว" : "อ่านการแจ้งเตือนทั้งหมดแล้ว");
      window.dispatchEvent(new Event("student-notifications-changed"));
      if (href) router.push(href);
    } catch { setError("บันทึกสถานะไม่สำเร็จ กรุณาลองใหม่"); }
    finally { setBusy(false); }
  }
  function safeHref(href: string) {
    return /^\/(?!\/)/.test(href) && !/[\\\x00-\x20]/.test(href) ? href : "/applications";
  }
  return <div className={styles.root} aria-busy={loading || busy}>
    <div className={styles.toolbar}>
      <strong>ยังไม่อ่าน {data?.unread ?? "…"} รายการ</strong>
      <button className="btn secondary" disabled={busy || loading || !data?.unread} onClick={() => void mark()}>อ่านทั้งหมด</button>
      <button className="btn secondary" disabled={loading || busy} onClick={() => void load()}>รีเฟรช</button>
    </div>
    {!compact && <label className={styles.filter}><input type="checkbox" checked={unreadOnly} disabled={busy}
      onChange={e => { setUnreadOnly(e.target.checked); setPage(1); setData(null); }} /> เฉพาะที่ยังไม่อ่าน</label>}
    {loading && <p role="status">กำลังโหลด…</p>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {!loading && data?.items.length === 0 && <p>ไม่มีการแจ้งเตือนในหน้านี้</p>}
    <ul className={styles.list}>
      {(compact ? data?.items.slice(0, 5) : data?.items)?.map(item => <li key={item.id}
        className={item.read_at ? styles.card : `${styles.card} ${styles.unread}`}>
        <span>{item.read_at ? "อ่านแล้ว" : "ยังไม่อ่าน"}</span>
        <h2>{item.title}</h2><p>{item.body}</p>
        <time dateTime={item.created_at}>{new Date(item.created_at).toLocaleString("th-TH")}</time>
        <div className={styles.actions}>
          <button className="btn secondary" disabled={busy || loading} onClick={() => void mark(item.id, safeHref(item.href))}>ดูรายละเอียด</button>
          {!item.read_at && <button className="btn secondary" disabled={busy || loading} onClick={() => void mark(item.id)}>อ่านแล้ว</button>}
        </div>
      </li>)}
    </ul>
    {compact ? <Link href="/notifications">ดูการแจ้งเตือนทั้งหมด ›</Link> :
      <nav className={styles.toolbar} aria-label="หน้าการแจ้งเตือน">
        <button className="btn secondary" disabled={page === 1 || loading || busy}
          onClick={() => { setData(null); setPage(p => p - 1); }}>ก่อนหน้า</button>
        <span>หน้า {page}</span>
        <button className="btn secondary" disabled={loading || busy || !data || page * 20 >= data.total}
          onClick={() => { setData(null); setPage(p => p + 1); }}>ถัดไป</button>
      </nav>}
  </div>;
}
