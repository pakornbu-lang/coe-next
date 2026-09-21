import { timingSafeEqual } from "node:crypto";
import { dispatchNotificationEmails } from "@/lib/notifications/email";

export const runtime = "nodejs";

function matchesSecret(provided: string, expected: string) {
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function POST(request: Request) {
  const expected = process.env.NOTIFICATION_DISPATCH_SECRET;
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!expected || !matchesSecret(provided, expected)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const result = await dispatchNotificationEmails();
  return Response.json(result, { status: result.configured ? 200 : 503 });
}
