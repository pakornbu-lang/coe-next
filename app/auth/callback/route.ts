import {
  NextResponse,
  type NextRequest,
} from "next/server";

import {
  createClient,
} from "@/lib/supabase/server";

import {
  siteUrl,
} from "@/lib/auth/site-url";

/* =========================
   AUTH CALLBACK
========================= */

export async function GET(
  request: NextRequest,
) {
  const params =
    request.nextUrl.searchParams;

  const code =
    params.get("code");

  const tokenHash =
    params.get("token_hash");

  const type =
    params.get("type");

  const next =
    params.get("next");

  /* =========================
     CHECK RECOVERY FLOW
  ========================= */

  const recovery =
    next ===
      "/reset-password" ||
    type ===
      "recovery";

  /* =========================
     REDIRECT HELPER
  ========================= */

  const response = (
    path: string,
  ) => {
    const result =
      NextResponse.redirect(
        new URL(
          path,
          siteUrl(),
        ),
      );

    result.headers.set(
      "Cache-Control",
      "private, no-store",
    );

    result.headers.set(
      "Referrer-Policy",
      "no-referrer",
    );

    return result;
  };

  try {
    const client =
      await createClient();

    /* =========================
       PASSWORD RECOVERY
       แบบ token_hash
    ========================= */

    if (
      tokenHash &&
      type === "recovery"
    ) {
      const {
        data,
        error,
      } =
        await client.auth.verifyOtp(
          {
            token_hash:
              tokenHash,

            type:
              "recovery",
          },
        );

      if (
        error ||
        !data.user
      ) {
        return response(
          "/forgot-password?error=verification",
        );
      }

      return response(
        "/reset-password",
      );
    }

    /* =========================
       EMAIL CONFIRMATION
       code จาก Supabase
    ========================= */

    if (code) {
      const {
        data,
        error,
      } =
        await client.auth
          .exchangeCodeForSession(
            code,
          );

      if (
        error ||
        !data.user
      ) {
        return response(
          recovery
            ? "/forgot-password?error=verification"
            : "/auth/confirmation-help?error=verification",
        );
      }

      /* =========================
         RECOVERY
      ========================= */

      if (recovery) {
        return response(
          "/reset-password",
        );
      }

      /* =========================
         SIGNUP CONFIRMED

         Supabase สร้าง session
         หลังยืนยัน Email

         แต่ requirement ของเรา:
         ยืนยัน -> กลับหน้า Login
         ไม่เข้า Dashboard ทันที

         จึง sign out session
         ที่สร้างจาก verification ก่อน
      ========================= */

      await client.auth.signOut({
        scope: "local",
      });

      return response(
        "/login?confirmed=1",
      );
    }

    /* =========================
       INVALID CALLBACK
    ========================= */

    return response(
      recovery
        ? "/forgot-password?error=expired"
        : "/auth/confirmation-help?error=expired",
    );
  } catch {
    return response(
      recovery
        ? "/forgot-password?error=verification"
        : "/auth/confirmation-help?error=verification",
    );
  }
}