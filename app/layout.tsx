import type { Metadata } from "next";
import type { ReactNode } from "react";
import AppLayout from "@/components/portal/Shell";
import { getViewer } from "@/lib/auth/server";
import { getNotifications } from "@/lib/scholarships/server";
import "./globals.css";
import "./ui-v1.css";
import "./workflow.css";

export const metadata: Metadata = {
  title: {
    default: "ระบบติดตามทุนการศึกษา",
    template: "%s | ระบบติดตามทุนการศึกษา",
  },
  description: "ระบบจัดการและติดตามทุนการศึกษาภายในมหาวิทยาลัย",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const viewer = await getViewer();
  const notifications = viewer ? await getNotifications(viewer.id) : [];
  return (
    <html lang="th" data-scroll-behavior="smooth">
      <body>
        <AppLayout key={viewer?.id ?? "guest"} viewer={viewer} notifications={notifications}>{children}</AppLayout>
      </body>
    </html>
  );
}
