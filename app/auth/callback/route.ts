import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { readViewer } from "@/lib/auth/server";
import { homeForRole } from "@/lib/auth/types";
import { siteUrl } from "@/lib/auth/site-url";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  const recovery = params.get("next") === "/reset-password" || params.get("type") === "recovery";
  const response = (path: string) => {
    const result = NextResponse.redirect(new URL(path, siteUrl()));
    result.headers.set("Cache-Control", "private, no-store");
    result.headers.set("Referrer-Policy", "no-referrer");
    return result;
  };
  try {
    const client = await createClient();
    const result = tokenHash && params.get("type") === "recovery"
      ? await client.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" })
      : code ? await client.auth.exchangeCodeForSession(code) : null;
    if (result && !result.error && result.data.user) {
      if (recovery) return response("/reset-password");
      const viewer = await readViewer(client, result.data.user);
      if (viewer) return response(homeForRole(viewer.role));
      await client.auth.signOut({ scope: "local" });
    }
  } catch {
    return response(recovery ? "/forgot-password?error=verification" : "/auth/confirmation-help");
  }
  return response(recovery ? "/forgot-password?error=expired" : "/auth/confirmation-help");
}
