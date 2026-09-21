"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Brand, Icon } from "./Shared";
import LogoutButton from "@/components/auth/LogoutButton";
import Avatar from "@/components/account/Avatar";
import { homeForRole, roleLabels, type Viewer } from "@/lib/auth/types";
import type { Notification } from "@/lib/scholarships/types";
import NotificationMenu from "./NotificationMenu";

export default function Shell({ children, viewer, notifications = [] }: { children: ReactNode; viewer: Viewer | null; notifications?: Notification[] }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const profileMenu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const menu = profileMenu.current;
    if (!menu) return;
    menu.open = false;
    function outside(event: PointerEvent) {
      if (event.target instanceof Node && !menu!.contains(event.target)) menu!.open = false;
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape" && menu!.open) {
        menu!.open = false;
        menu!.querySelector("summary")?.focus();
      }
    }
    function focusOutside(event: FocusEvent) {
      if (event.target instanceof Node && !menu!.contains(event.target)) menu!.open = false;
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    document.addEventListener("focusin", focusOutside);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
      document.removeEventListener("focusin", focusOutside);
    };
  }, [path, viewer?.id]);
  const auth = path === "/login" || path === "/register";
  const landing = path === "/";
  const nav = !viewer
    ? [
        ["/", "หน้าแรก", "home"],
        ["/scholarships", "ทุนการศึกษา", "cap"],
        ["/#steps", "ขั้นตอนการสมัคร", "file"],
        ["/#contact", "ติดต่อ", "mail"],
      ]
    : viewer.role === "admin"
      ? [["/admin", "จัดการสมาชิก", "people"], ["/admin/reference", "ข้อมูลพื้นฐาน", "folder"], ["/admin/audit", "ประวัติการแก้ไข", "file"]]
    : viewer.role === "staff"
      ? [
          ["/staff", "แดชบอร์ด", "home"],
          ["/staff/scholarships", "ทุนการศึกษา", "cap"],
          ["/staff/review", "ตรวจเอกสาร", "check"],
          ["/staff/review?status=approved", "อนุมัติ / จ่ายทุน", "chart"],
          ["/staff/reports", "รายงาน", "file"],
        ]
      : viewer.role === "committee"
        ? [
            ["/committee", "พื้นที่กรรมการ", "home"],
            ["/staff/evaluation", "พิจารณาทุน", "people"],
            ["/scholarships", "ทุนการศึกษา", "cap"],
          ]
        : [
            ["/dashboard", "แดชบอร์ด", "home"],
            ["/scholarships", "ทุนการศึกษา", "cap"],
            ["/apply", "สมัครทุน", "edit"],
            ["/applications", "ใบสมัครของฉัน", "file"],
            ["/profile", "โปรไฟล์", "user"],
          ];
  if (auth) return <>{children}</>;
  return (
    <div className="ui-app">
      <a className="skip" href="#main-content">ข้ามไปเนื้อหาหลัก</a>
      <header className="topbar">
        <Brand />
        <button className="menu-toggle btn secondary" aria-label="เปิดหรือปิดเมนู"
          aria-expanded={open} onClick={() => setOpen(!open)}>☰</button>
        <nav className={open ? "open" : ""} aria-label="เมนูหลัก">
          {nav.map(([url, label, icon]) => (
            <Link key={url} href={url} onClick={() => setOpen(false)}
              className={path === url.split(/[?#]/)[0] || (url === "/scholarships" && path.startsWith("/scholarships/")) ? "active" : ""}
              aria-current={path === url.split(/[?#]/)[0] ? "page" : undefined}>
              <Icon name={icon} size={20} /><span>{label}</span>
            </Link>
          ))}
        </nav>
        {!viewer ? (
          <div className="header-actions">
            <Link className="btn secondary" href="/register">สมัครสมาชิก</Link>
            <Link className="btn" href="/login">เข้าสู่ระบบ</Link>
          </div>
        ) : (
          <div className="account">
            <NotificationMenu notifications={notifications} />
            <details ref={profileMenu}>
              <summary aria-label="เมนูบัญชีผู้ใช้">
                <Avatar version={viewer.avatarVersion} name={viewer.fullName} />
                <span>
                  <strong>{viewer.fullName}</strong>
                  <small>{roleLabels[viewer.role]} · {viewer.studentId}</small>
                </span>
                <span>⌄</span>
              </summary>
              <div className="popover" onClick={event => {
                if (event.target instanceof Element && event.target.closest("a, button") && profileMenu.current) {
                  profileMenu.current.open = false;
                }
              }}>
                <Link href="/profile">โปรไฟล์ของฉัน</Link>
                <Link href={homeForRole(viewer.role)}>หน้าหลักของฉัน</Link>
                <Link href="/">กลับหน้าแรก</Link>
                <LogoutButton />
              </div>
            </details>
          </div>
        )}
      </header>
      <main id="main-content" className={landing ? "landing" : "workspace"}>
        {children}
      </main>
      <footer className="site-footer">
        <span>ระบบติดตามทุนการศึกษา · ระบบทุนการศึกษาภายในมหาวิทยาลัย</span>
        <small>ข้อมูลส่วนบุคคลและเอกสารได้รับการคุ้มครองตามสิทธิ์ของบัญชี</small>
      </footer>
    </div>
  );
}
