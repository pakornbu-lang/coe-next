import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { authCookieOptions, isAuthConfigured, supabaseConfig } from "@/lib/supabase/config";

function hasSupabaseSession(request: NextRequest) {
  return request.cookies.getAll().some(({ name }) =>
    name.startsWith("sb-") && name.includes("-auth-token"),
  );
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  // Guest requests cannot refresh a Supabase session. Skipping this avoids an
  // unnecessary Auth call for public pages, bots, cron jobs, and API requests.
  if (isAuthConfigured() && hasSupabaseSession(request)) {
    const { url, key } = supabaseConfig();
    const supabase = createServerClient(url, key, {
      cookieOptions: authCookieOptions,
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
        },
      },
    });
    await supabase.auth.getClaims();
    // Session-specific HTML must not be cached or shared between users.
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    response.headers.set("Pragma", "no-cache");
  }
  // Authorization is checked again on the server in every protected page/action.
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
