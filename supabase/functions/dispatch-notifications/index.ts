// Supabase Edge Function: dispatch-notifications
// Invoked periodically via Supabase Cron (pg_cron) or external scheduler
// Processes up to 20 pending notification emails per execution.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const expectedSecret = Deno.env.get("NOTIFICATION_DISPATCH_SECRET") || Deno.env.get("CRON_SECRET");

    if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const siteUrl = Deno.env.get("NEXT_PUBLIC_SITE_URL") ?? "http://localhost:3000";
    const appsScriptUrl = Deno.env.get("NOTIFICATION_APPS_SCRIPT_URL");
    const appsScriptSecret = Deno.env.get("NOTIFICATION_APPS_SCRIPT_SECRET");

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return new Response(JSON.stringify({ error: "Missing Supabase configuration" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Call enqueue_workflow_reminders RPC if exists
    await supabase.rpc("enqueue_workflow_reminders").catch(() => null);

    // If external dispatch API URL is set, proxy/call it
    const webDispatchUrl = `${siteUrl.replace(/\/$/, "")}/api/notifications/dispatch`;
    if (expectedSecret) {
      const response = await fetch(webDispatchUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${expectedSecret}`,
          "Content-Type": "application/json",
        },
      });

      const data = await response.json().catch(() => ({}));
      return new Response(JSON.stringify({ edge_worker: true, status: response.status, data }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, message: "Dispatcher ready" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

