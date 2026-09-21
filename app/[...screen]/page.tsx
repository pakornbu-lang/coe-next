import { notFound, redirect } from "next/navigation";
import AuthPage from "@/components/auth/LoginPage";
import { getViewer } from "@/lib/auth/server";
import { homeForRole } from "@/lib/auth/types";
type Props = {
  params: Promise<{ screen: string[] }>;
  searchParams: Promise<{ reset?: string }>;
};
export async function generateMetadata({ params }: Props) {
  const route = "/" + (await params).screen.join("/");
  return {
    title: route === "/login" ? "เข้าสู่ระบบ" : route === "/register" ? "สมัครสมาชิก" : "ไม่พบหน้า",
  };
}
export default async function Page({ params, searchParams }: Props) {
  const path = (await params).screen.join("/");
  if (path === "login" || path === "register") {
    const viewer = await getViewer();
    if (viewer) redirect(homeForRole(viewer.role));
  }
  if (path === "register") return <AuthPage register />;
  if (path === "login") return <AuthPage resetComplete={(await searchParams).reset === "success"} />;
  notFound();
}
