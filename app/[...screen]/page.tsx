import {
  notFound,
  redirect,
} from "next/navigation";

import AuthPage from "@/components/auth/LoginPage";

import {
  getViewer,
} from "@/lib/auth/server";

import {
  homeForRole,
} from "@/lib/auth/types";

type Props = {
  params: Promise<{
    screen: string[];
  }>;

  searchParams: Promise<{
    reset?: string;
    confirmed?: string;
  }>;
};

export async function generateMetadata({
  params,
}: Props) {
  const route =
    "/" +
    (
      await params
    ).screen.join("/");

  return {
    title:
      route === "/login"
        ? "เข้าสู่ระบบ"
        : route === "/register"
          ? "สมัครสมาชิก"
          : "ไม่พบหน้า",
  };
}

export default async function Page({
  params,
  searchParams,
}: Props) {
  const path =
    (
      await params
    ).screen.join("/");

  /* =========================
     ถ้า Login อยู่แล้ว
     ไม่ให้กลับหน้า Login/Register
  ========================= */

  if (
    path === "login" ||
    path === "register"
  ) {
    const viewer =
      await getViewer();

    if (viewer) {
      redirect(
        homeForRole(
          viewer.role,
        ),
      );
    }
  }

  /* =========================
     REGISTER
  ========================= */

  if (
    path === "register"
  ) {
    return (
      <AuthPage register />
    );
  }

  /* =========================
     LOGIN
  ========================= */

  if (
    path === "login"
  ) {
    const query =
      await searchParams;

    return (
      <AuthPage
        resetComplete={
          query.reset ===
          "success"
        }
        confirmed={
          query.confirmed ===
          "1"
        }
      />
    );
  }

  notFound();
}