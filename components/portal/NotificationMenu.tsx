"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";
import { markNotificationRead } from "@/app/actions/notifications";
import type { Notification } from "@/lib/scholarships/types";
import { Icon } from "./Shared";

export default function NotificationMenu({ notifications }: { notifications: Notification[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const unread = notifications.filter((notification) => !notification.read_at).length;
  const openNotification = (id: string) => {
    setBusy(id);
    startTransition(async () => {
      await markNotificationRead(id);
      setBusy(null);
      router.refresh();
    });
  };
  return <details className="notification-menu">
    <summary aria-label={unread ? `การแจ้งเตือนใหม่ ${unread} รายการ` : "การแจ้งเตือน"}>
      <Icon name="bell" />{unread > 0 && <span className="notification-count">{unread > 9 ? "9+" : unread}</span>}
    </summary>
    <div className="popover notification-popover">
      <strong>การแจ้งเตือน{unread > 0 ? ` ใหม่ ${unread} รายการ` : ""}</strong>
      {notifications.length ? notifications.map((notification) => <Link
        className={notification.read_at ? "" : "notification-unread"}
        key={notification.id}
        href={notification.href}
        aria-busy={busy === notification.id}
        onClick={() => openNotification(notification.id)}
      ><strong>{notification.title}</strong><small>{notification.body}</small></Link>) : <p>ยังไม่มีการแจ้งเตือน</p>}
    </div>
  </details>;
}
