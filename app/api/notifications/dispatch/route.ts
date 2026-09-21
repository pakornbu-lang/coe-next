import { timingSafeEqual } from "node:crypto";
import { dispatchNotificationEmails } from "@/lib/notifications/email";

export const runtime = "nodejs";

function matchesSecret(provided: string, expected: string) {
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

async function dispatch(request: Request) {
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const secrets = [process.env.NOTIFICATION_DISPATCH_SECRET, process.env.CRON_SECRET].filter((secret): secret is string => Boolean(secret));
  if (!secrets.length || !secrets.some((secret) => matchesSecret(provided, secret))) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const result = await dispatchNotificationEmails();
  return Response.json(result, { status: result.configured ? 200 : 503 });
}

export async function POST(request: Request) {
  return dispatch(request);
}

export async function GET(request: Request) {
  return dispatch(request);
}
