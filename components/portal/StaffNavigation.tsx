"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { Icon } from "./Shared";

type Item = { href: string; label: string; icon: string };
const groups: { label: string; icon: string; items: Item[] }[] = [
  { label: "ใบสมัคร", icon: "file", items: [
    { href: "/staff/review", label: "ตรวจเอกสาร", icon: "check" },
    { href: "/staff/review?status=approved", label: "อนุมัติ / จ่ายทุน", icon: "chart" },
  ] },
  { label: "การประเมิน", icon: "people", items: [
    { href: "/staff/assignments", label: "งานกรรมการ", icon: "people" },
    { href: "/staff/interviews", label: "สัมภาษณ์", icon: "file" },
    { href: "/staff/evaluations", label: "สรุปคะแนน", icon: "chart" },
  ] },
];

export default function StaffNavigation({ onNavigate }: { onNavigate: () => void }) {
  const path = usePathname();
  const search = useSearchParams();
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = container.current;
    if (!root) return;
    const close = () => root.querySelectorAll("details").forEach(menu => { menu.open = false; });
    close();
    const outside = (event: Event) => {
      if (event.target instanceof Node && !root.contains(event.target)) close();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const menu = root.querySelector<HTMLDetailsElement>("details[open]");
      if (menu) { menu.open = false; menu.querySelector("summary")?.focus(); }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("focusin", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [path, search]);

  function active(href: string) {
    const [pathname, query] = href.split("?");
    const matches = path === pathname || (pathname !== "/staff" && path.startsWith(`${pathname}/`));
    if (!matches) return false;
    if (pathname === "/staff/review" && path === pathname) {
      return query ? search.get("status") === "approved" : search.get("status") !== "approved";
    }
    return !query;
  }

  function link(item: Item) {
    const selected = active(item.href);
    return <Link key={item.href} href={item.href} className={selected ? "active" : undefined}
      aria-current={selected ? "page" : undefined} onClick={() => {
        container.current?.querySelectorAll("details").forEach(menu => { menu.open = false; });
        onNavigate();
      }}><Icon name={item.icon} size={20}/><span>{item.label}</span></Link>;
  }

  return <div className="staff-navigation" ref={container}>
    {link({ href: "/staff", label: "แดชบอร์ด", icon: "home" })}
    {link({ href: "/staff/scholarships", label: "ทุนการศึกษา", icon: "cap" })}
    {groups.map(group => <details key={group.label} className="staff-nav-group" onToggle={event => {
      const current = event.currentTarget;
      if (current.open) container.current?.querySelectorAll("details").forEach(menu => {
        if (menu !== current) menu.open = false;
      });
    }}>
      <summary className={group.items.some(item => active(item.href)) ? "active" : undefined}>
        <Icon name={group.icon} size={20}/><span>{group.label}</span><span className="staff-nav-chevron" aria-hidden="true">⌄</span>
      </summary>
      <div className="staff-nav-dropdown">{group.items.map(link)}</div>
    </details>)}
    {link({ href: "/staff/reports", label: "รายงาน", icon: "chart" })}
  </div>;
}
