import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import {
  notificationEmailHtml,
  notificationEmailText,
} from "../_shared/notification-template.ts";

type OutboxRow = {
  id: string;
  to_email: string;
  subject: string;
  body: string;
  href: string;
  attempts: number;
  max_retries: number;
};

type DeliveryResult = {
  id: string;
  delivered: boolean;
  provider_id: string | null;
  error: string;
};

const BATCH_LIMIT = 20;
const SEND_CONCURRENCY = 4;

function requiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function emailConfiguration() {
  const endpoint = requiredEnv("NOTIFICATION_APPS_SCRIPT_URL");
  const secret = requiredEnv("NOTIFICATION_APPS_SCRIPT_SECRET");
  const site = requiredEnv("SITE_URL");

  const endpointUrl = new URL(endpoint);
  if (
    endpointUrl.protocol !== "https:" ||
    !endpointUrl.hostname.endsWith("script.google.com")
  ) {
    throw new Error("Invalid NOTIFICATION_APPS_SCRIPT_URL");
  }

  const siteUrl = new URL(site);
  if (siteUrl.protocol !== "https:") {
    throw new Error("SITE_URL must use HTTPS");
  }

  return {
    endpoint: endpointUrl.toString(),
    secret,
    site: siteUrl.origin,
  };
}

async function deliver(
  row: OutboxRow,
  config: ReturnType<typeof emailConfiguration>,
): Promise<DeliveryResult> {
  try {
    const actionUrl = new URL(row.href, config.site).toString();

    const response = await fetch(config.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        secret: config.secret,
        message: {
          to: row.to_email,
          subject: row.subject,
          text: notificationEmailText({
            subject: row.subject,
            body: row.body,
            actionUrl,
          }),
          html: notificationEmailHtml({
            subject: row.subject,
            body: row.body,
            actionUrl,
          }),
        },
      }),
      signal: AbortSignal.timeout(15000),
    });

    const payload = await response
      .json()
      .catch(() => null) as {
        ok?: boolean;
        error?: string;
        requestId?: string;
      } | null;

    if (!response.ok) {
      return {
        id: row.id,
        delivered: false,
        provider_id: null,
        error: `Apps Script returned ${response.status}`,
      };
    }

    if (!payload?.ok) {
      return {
        id: row.id,
        delivered: false,
        provider_id: null,
        error: payload?.error || "Apps Script did not confirm delivery",
      };
    }

    return {
      id: row.id,
      delivered: true,
      provider_id: payload.requestId ?? null,
      error: "",
    };
  } catch (error) {
    return {
      id: row.id,
      delivered: false,
      provider_id: null,
      error:
        error instanceof Error
          ? error.message
          : "Unable to contact email provider",
    };
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const output = new Array<R>(items.length);
  let cursor = 0;

  async function run() {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      output[index] = await worker(items[index]);
    }
  }

  const workers = Array.from(
    {
      length: Math.min(
        Math.max(concurrency, 1),
        Math.max(items.length, 1),
      ),
    },
    () => run(),
  );

  await Promise.all(workers);
  return output;
}

export default {
  fetch: withSupabase(
    { auth: "secret:notification_dispatcher" },
    async (request, ctx) => {
      if (request.method !== "POST") {
        return Response.json(
          { error: "Method not allowed" },
          {
            status: 405,
            headers: { Allow: "POST" },
          },
        );
      }

      let config: ReturnType<typeof emailConfiguration>;

      try {
        config = emailConfiguration();
      } catch (error) {
        return Response.json(
          {
            error:
              error instanceof Error
                ? error.message
                : "Email configuration is incomplete",
          },
          { status: 503 },
        );
      }

      const { data: remindersQueued, error: reminderError } =
        await ctx.supabaseAdmin.rpc("enqueue_workflow_reminders");

      if (reminderError) {
        console.error(
          "Unable to enqueue workflow reminders",
          reminderError,
        );
      }

      const { data, error } = await ctx.supabaseAdmin.rpc(
        "claim_notification_email_batch",
        {
          p_limit: BATCH_LIMIT,
        },
      );

      if (error) {
        console.error("Unable to claim email batch", error);
        return Response.json(
          { error: "Unable to claim email batch" },
          { status: 500 },
        );
      }

      const rows = (data ?? []) as OutboxRow[];

      if (!rows.length) {
        return Response.json({
          processed: 0,
          sent: 0,
        });
      }

      const results = await mapWithConcurrency(
        rows,
        SEND_CONCURRENCY,
        (row) => deliver(row, config),
      );

      const { data: completed, error: completionError } =
        await ctx.supabaseAdmin.rpc(
          "complete_notification_email_batch",
          {
            p_results: results,
          },
        );

      if (completionError) {
        console.error(
          "Unable to finalize email batch",
          completionError,
        );

        return Response.json(
          {
            error: "Unable to finalize email batch",
            processed: rows.length,
          },
          { status: 500 },
        );
      }

      return Response.json({
        processed: rows.length,
        completed: completed ?? 0,
        sent: results.filter((item) => item.delivered).length,
      });
    },
  ),
};
