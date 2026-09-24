"use client";
import { useEffect, useRef, useState } from "react";
import StudentNotifications from "./StudentNotifications";
import { Icon } from "./Shared";
export default function StudentNotificationMenu({ audience = "student" }: { audience?: "student" | "member" }) {
  const menu = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState<number | null>(null);
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    let request: AbortController | null = null;
    let retryDelay = 60000;
    async function refresh() {
      clearTimeout(timer);
      if (stopped || request || document.hidden) return;
      request = new AbortController();
      try {
        const response = await fetch(`/api/${audience}/notifications?countOnly=true`, { cache: "no-store", signal: request.signal });
        if (response.status === 401 || response.status === 403) { stopped = true; setUnread(null); return; }
        if (!response.ok) throw new Error("Count unavailable");
        const data = await response.json();
        if (!stopped) setUnread(data.unread);
        retryDelay = 60000;
      } catch { retryDelay = Math.min(retryDelay * 2, 300000); }
      finally {
        request = null;
        if (!stopped) timer = setTimeout(() => void refresh(), retryDelay);
      }
    }
    const changed = () => void refresh();
    const visible = () => { if (!document.hidden) void refresh(); };
    timer = setTimeout(changed, 0);
    window.addEventListener("student-notifications-changed", changed);
    document.addEventListener("visibilitychange", visible);
    return () => {
      stopped = true; clearTimeout(timer); request?.abort();
      window.removeEventListener("student-notifications-changed", changed);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [audience]);
  useEffect(() => {
    function outside(e: PointerEvent) {
      if (e.target instanceof Node && !menu.current?.contains(e.target) && menu.current) menu.current.open = false;
    }
    function escape(e: KeyboardEvent) {
      if (e.key === "Escape" && menu.current?.open) {
        menu.current.open = false; menu.current.querySelector("summary")?.focus();
      }
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, []);
  return <details ref={menu} className="notification-menu" onToggle={e => setOpen(e.currentTarget.open)}>
    <summary style={{ position: "relative" }} aria-label={`การแจ้งเตือน${unread === null ? "" : ` ยังไม่อ่าน ${unread} รายการ`}`}>
      <Icon name="bell" />
      {!!unread && <span className="notification-unread-badge" aria-hidden="true">{unread > 99 ? "99+" : unread}</span>}
    </summary>
    <div className="popover notification-popover" style={{ maxHeight: "70vh", overflowY: "auto", width: "min(420px, 90vw)" }}>
      {open && <StudentNotifications compact audience={audience} />}
    </div>
  </details>;
}
