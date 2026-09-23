import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: Request, context: RouteContext<"/documents/versions/[id]">) {
  await requireRole(["student", "staff"]);
  const { id } = await context.params;
  const client = await createClient();
  const { data: version, error } = await client.from("application_document_versions")
    .select("file_path,file_name").eq("id", id).maybeSingle();
  if (error || !version) return new NextResponse("Not found", { status: 404 });
  const { data, error: signedUrlError } = await client.storage.from("scholarship-documents")
    .createSignedUrl(version.file_path, 60, { download: version.file_name });
  if (signedUrlError || !data?.signedUrl) return new NextResponse("Unable to prepare document", { status: 403 });
  return NextResponse.redirect(data.signedUrl, { headers: { "Cache-Control": "private, no-store" } });
}
