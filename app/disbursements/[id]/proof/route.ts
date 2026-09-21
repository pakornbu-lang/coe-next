import { NextResponse } from "next/server";
import { requireViewer } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: Request, context: RouteContext<"/disbursements/[id]/proof">) {
  await requireViewer();
  const { id } = await context.params;
  const client = await createClient();
  const { data: disbursement, error } = await client.from("disbursements").select("proof_path").eq("id", id).maybeSingle();
  if (error || !disbursement?.proof_path) return new NextResponse("Not found", { status: 404 });
  const { data, error: signedUrlError } = await client.storage.from("scholarship-payment-proofs").createSignedUrl(disbursement.proof_path, 60, { download: true });
  if (signedUrlError || !data?.signedUrl) return new NextResponse("Unable to prepare proof", { status: 403 });
  return NextResponse.redirect(data.signedUrl);
}
