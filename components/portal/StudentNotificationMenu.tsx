"use client";
import { useEffect, useRef, useState } from "react";
import StudentNotifications from "./StudentNotifications";
import { Icon } from "./Shared";
export default function StudentNotificationMenu() {
  const menu = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);
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
    <summary aria-label="การแจ้งเตือนนักศึกษา"><Icon name="bell" /></summary>
    <div className="popover notification-popover" style={{ maxHeight: "70vh", overflowY: "auto", width: "min(420px, 90vw)" }}>
      {open && <StudentNotifications compact />}
    </div>
  </details>;
}
