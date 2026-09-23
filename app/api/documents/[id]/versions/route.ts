import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";

type DatabaseError = { code?: string; message?: string };

function isMissingSchemaObject(error: DatabaseError | null) {
  return Boolean(error && ["42P01", "PGRST204", "PGRST205"].includes(error.code ?? ""));
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  await requireRole(["student", "staff"]);
  const { id } = await context.params;
  const searchParams = new URL(request.url).searchParams;
  const requestedLimit = Number(searchParams.get("limit") ?? "20");
  const limit = Number.isSafeInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 50) : 20;
  const before = searchParams.get("before");
  const beforeRevision = before && /^\d+$/.test(before) ? Number(before) : null;
  const client = await createClient();
  let query = client.from("application_document_versions")
    .select("id,document_id,revision_no,file_name,file_size,mime_type,status,feedback,uploaded_at,checked_at")
    .eq("document_id", id)
    .order("revision_no", { ascending: false })
    .limit(limit + 1);
  if (beforeRevision !== null) query = query.lt("revision_no", beforeRevision);
  const { data, error } = await query;
  if (error) {
    if (isMissingSchemaObject(error)) return NextResponse.json({ versions: [], nextCursor: null });
    return NextResponse.json({ error: "ไม่สามารถโหลดประวัติเวอร์ชันได้" }, { status: 500 });
  }
  const versions = (data ?? []).slice(0, limit);
  const hasMore = (data ?? []).length > limit;
  return NextResponse.json({
    versions,
    nextCursor: hasMore ? String(versions.at(-1)?.revision_no ?? "") : null,
  }, { headers: { "Cache-Control": "private, no-store" } });
}
