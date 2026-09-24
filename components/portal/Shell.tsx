"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { Brand, Icon } from "./Shared";
import LogoutButton from "@/components/auth/LogoutButton";
import Avatar from "@/components/account/Avatar";
import { homeForRole, roleLabels, type Viewer } from "@/lib/auth/types";
import type { Notification } from "@/lib/scholarships/types";
import StudentNotificationMenu from "./StudentNotificationMenu";
import StaffNavigation from "./StaffNavigation";

export default function Shell({ children, viewer }: { children: ReactNode; viewer: Viewer | null; notifications?: Notification[] }) {
  const path = usePathname();
  const contentRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const content = contentRef.current;
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!content || motionPreference.matches) return;
    const animation = content.animate(
      [
        { opacity: 0, transform: "translateY(6px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      { duration: 180, easing: "ease-out" },
    );
    const stopForReducedMotion = () => {
      if (motionPreference.matches) animation.cancel();
    };
    motionPreference.addEventListener("change", stopForReducedMotion);
    return () => {
      animation.cancel();
      motionPreference.removeEventListener("change", stopForReducedMotion);
    };
  }, [path]);
  const [open, setOpen] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const scrollAnimation = useRef<number | null>(null);
  const stopScrollAnimation = () => {
    if (scrollAnimation.current !== null) cancelAnimationFrame(scrollAnimation.current);
    scrollAnimation.current = null;
  };
  const scrollToTop = () => {
    stopScrollAnimation();
    const startY = window.scrollY;
    const startX = window.scrollX;
    const startedAt = performance.now();
    const animate = (now: number) => {
      const progress = Math.min((now - startedAt) / 700, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      // Each frame sets an exact position; native smooth scrolling would compete.
      window.scrollTo({ top: startY * (1 - eased), left: startX, behavior: "instant" });
      if (progress < 1) scrollAnimation.current = requestAnimationFrame(animate);
      else {
        scrollAnimation.current = null;
        headerRef.current?.focus({ preventScroll: true });
      }
    };
    scrollAnimation.current = requestAnimationFrame(animate);
  };
  useEffect(() => {
    const cancel = () => stopScrollAnimation();
    const cancelWithKey = (event: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " ", "Escape", "Tab"].includes(event.key)) cancel();
    };
    window.addEventListener("wheel", cancel, { passive: true });
    window.addEventListener("touchstart", cancel, { passive: true });
    window.addEventListener("pointerdown", cancel, { passive: true });
    window.addEventListener("keydown", cancelWithKey);
    return () => {
      cancel();
      window.removeEventListener("wheel", cancel);
      window.removeEventListener("touchstart", cancel);
      window.removeEventListener("pointerdown", cancel);
      window.removeEventListener("keydown", cancelWithKey);
    };
  }, [path]);
  useEffect(() => {
    const update = () => setShowBackToTop(window.scrollY > 300);
    const frame = requestAnimationFrame(update);
    window.addEventListener("scroll", update, { passive: true });
    const header = headerRef.current;
    const observer = new ResizeObserver(() => {
      if (header) document.documentElement.style.setProperty("--portal-header-height", `${header.offsetHeight}px`);
    });
    if (header) observer.observe(header);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update);
      observer.disconnect();
      document.documentElement.style.removeProperty("--portal-header-height");
    };
  }, [path]);
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
      ? []
      : viewer.role === "committee"
        ? [
            ["/committee", "พื้นที่กรรมการ", "home"], ["/committee/interviews", "นัดสัมภาษณ์", "file"],
            ["/staff/evaluation", "พิจารณาทุน", "people"],
            ["/scholarships", "ทุนการศึกษา", "cap"],
          ]
        : [
            ["/dashboard", "แดชบอร์ด", "home"],
            ["/scholarships", "ทุนการศึกษา", "cap"],
            ["/apply", "สมัครทุน", "edit"],
            ["/applications", "ใบสมัครของฉัน", "file"],
            ["/notifications", "การแจ้งเตือน", "bell"],
            ["/profile", "โปรไฟล์", "user"],
          ];
  if (viewer && viewer.role !== "student" && viewer.role !== "staff") nav.push(["/notifications", "การแจ้งเตือน", "bell"]);
  if (viewer?.role === "admin") nav.push(["/admin/notifications", "การส่งอีเมล", "mail"]);
  if (auth) return <>{children}</>;
  return (
    <div className="ui-app">
      <a className="skip" href="#main-content">ข้ามไปเนื้อหาหลัก</a>
      <header ref={headerRef} tabIndex={-1} className={viewer?.role === "staff" ? "topbar staff-topbar" : "topbar"}>
        <Brand />
        <button className="menu-toggle btn secondary" aria-label="เปิดหรือปิดเมนู"
          aria-expanded={open} onClick={() => setOpen(!open)}>☰</button>
        <nav className={open ? "open" : ""} aria-label="เมนูหลัก">
          {viewer?.role === "staff" ? <Suspense fallback={<span>กำลังโหลดเมนู…</span>}>
            <StaffNavigation onNavigate={() => setOpen(false)} />
          </Suspense> : nav.map(([url, label, icon]) => (
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
            <StudentNotificationMenu key={path} audience={viewer.role === "student" ? "student" : "member"} />
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
      <main ref={contentRef} id="main-content" className={landing ? "landing" : "workspace"}>
        {children}
      </main>
      <footer className="site-footer">
        <span>ระบบติดตามทุนการศึกษา · ระบบทุนการศึกษาภายในมหาวิทยาลัย</span>
        <small>ข้อมูลส่วนบุคคลและเอกสารได้รับการคุ้มครองตามสิทธิ์ของบัญชี</small>
      </footer>
      {showBackToTop && <button type="button" className="back-to-top" aria-label="กลับขึ้นบนสุด" title="กลับขึ้นบนสุด" onClick={scrollToTop}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 12 6-6 6 6M12 6v14"/></svg>
      </button>}
    </div>
  );
}
