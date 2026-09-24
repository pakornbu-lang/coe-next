import { getViewer } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
  const viewer = await getViewer();
  if (!viewer) return new Response(null, { status: 401, headers });
  if (viewer.role !== "staff") return new Response(null, { status: 403, headers });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response(null, { status: 404, headers });
  // Verify access through application RLS before narrowly reading the applicant's photo.
  const client = await createClient();
  const { data: application, error } = await client.from("applications").select("student_id").eq("id", id).maybeSingle();
  if (error || !application) return new Response(null, { status: 404, headers });
  const admin = createAdminClient();
  if (!admin) return new Response(null, { status: 503, headers });
  const { data: profile } = await admin.from("portal_profiles").select("avatar_path").eq("id", application.student_id).maybeSingle();
  if (!profile?.avatar_path || !profile.avatar_path.startsWith(`${application.student_id}/`)) return new Response(null, { status: 404, headers });
  const { data, error: downloadError } = await admin.storage.from("portal-avatars").download(profile.avatar_path);
  if (downloadError || !data) return new Response(null, { status: 404, headers });
  return new Response(data, { headers: { ...headers, "Content-Type": "image/webp" } });
}
