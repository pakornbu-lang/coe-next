import { NextResponse } from "next/server";
import { requireViewer } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: Request, context: RouteContext<"/documents/[id]">) {
  await requireViewer();
  const { id } = await context.params;
  const client = await createClient();
  const { data: document, error } = await client.from("application_documents").select("file_path,file_name").eq("id", id).maybeSingle();
  if (error || !document) return new NextResponse("Not found", { status: 404 });
  const { data, error: signedUrlError } = await client.storage.from("scholarship-documents").createSignedUrl(document.file_path, 60, { download: document.file_name });
  if (signedUrlError || !data?.signedUrl) return new NextResponse("Unable to prepare document", { status: 403 });
  return NextResponse.redirect(data.signedUrl);
}
