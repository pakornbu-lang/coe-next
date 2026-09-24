import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const headers = {
    "Cache-Control": "private, max-age=300, must-revalidate",
    "Vary": "Cookie",
    "X-Content-Type-Options": "nosniff",
  };

  const client = await createClient();

  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser();

  if (authError || !user) {
    return new Response(null, { status: 401, headers });
  }

  const { data: profile, error } = await client
    .from("portal_profiles")
    .select("avatar_path,active")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !profile?.active || !profile.avatar_path) {
    return new Response(null, { status: 404, headers });
  }

  const { data, error: downloadError } = await client.storage
    .from("portal-avatars")
    .download(profile.avatar_path);

  if (downloadError || !data) {
    return new Response(null, { status: 404, headers });
  }

  return new Response(data, {
    headers: {
      ...headers,
      "Content-Type": "image/webp",
    },
  });
}