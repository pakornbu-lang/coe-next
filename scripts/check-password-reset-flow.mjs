import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(file, mocks) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, {
    exports, URL, process: { env: { NOTIFICATION_DISPATCH_SECRET: "test-only" } },
    require: (name) => name in mocks ? mocks[name] : require(name),
  });
  return exports;
}
let providerError = null;
let custom = false;
let delivered = true;
let sent;
const admin = {
  from: () => ({
    select: () => ({ eq: () => ({ gte: () => ({ order: () => ({ limit: async () => ({ data: [] }) }) }) }) }),
    delete: () => ({ lt: async () => ({}) }),
    insert: async () => ({}),
  }),
  auth: { admin: { generateLink: async () => ({ data: { properties: { hashed_token: "test-hash", action_link: "https://unused.example" } } }) } },
};
const common = {
  "@/lib/auth/site-url": { siteUrl: () => "http://localhost:3000" },
  "@/lib/supabase/server": { createClient: async () => ({ auth: {
    resetPasswordForEmail: async () => ({ error: providerError }),
  } }) },
};
const actions = load("app/actions/password-reset.ts", {
  ...common,
  "next/navigation": { redirect: () => {} },
  "@/lib/supabase/admin": { createAdminClient: () => custom ? admin : null },
  "@/lib/supabase/config": { isAuthConfigured: () => true },
  "@/lib/notifications/apps-script": {
    appsScriptEmailConfigured: () => true,
    sendAppsScriptEmail: async (message) => { sent = message; return { delivered }; },
  },
  "@/lib/notifications/template": { passwordResetEmailHtml: (url) => url, passwordResetEmailText: (url) => url },
});
const form = new FormData();
form.set("email", "test@example.com");
providerError = { status: 500 };
assert.equal((await actions.requestPasswordReset({}, form)).success, "");
providerError = { status: 429 };
assert.match((await actions.requestPasswordReset({}, form)).error, /หลายครั้ง/);
providerError = null;
assert.ok((await actions.requestPasswordReset({}, form)).success);
custom = true;
assert.ok((await actions.requestPasswordReset({}, form)).success);
const link = new URL(sent.text);
assert.equal(link.pathname, "/auth/callback");
assert.equal(link.searchParams.get("token_hash"), "test-hash");
assert.equal(link.searchParams.get("type"), "recovery");
delivered = false;
assert.equal((await actions.requestPasswordReset({}, form)).success, "");

let otpError = null;
let verified;
const callback = load("app/auth/callback/route.ts", {
  ...common,
  "next/server": { NextResponse: { redirect: (url) => ({ url: url.toString(), headers: new Headers() }) } },
  "@/lib/supabase/server": { createClient: async () => ({ auth: {
    verifyOtp: async (params) => { verified = params; return { error: otpError, data: { user: { id: "test" } } }; },
    exchangeCodeForSession: async () => ({ data: { user: { id: "test" } } }),
  } }) },
  "@/lib/auth/server": { readViewer: async () => ({ role: "student" }) },
  "@/lib/auth/types": { homeForRole: () => "/dashboard" },
});
assert.equal((await callback.GET({ nextUrl: link })).url, "http://localhost:3000/reset-password");
assert.equal(verified.type, "recovery");
otpError = { message: "Expired" };
assert.match((await callback.GET({ nextUrl: link })).url, /forgot-password\?error=expired/);
const pkce = new URL("http://localhost:3000/auth/callback?code=test&next=/reset-password");
assert.equal((await callback.GET({ nextUrl: pkce })).url, "http://localhost:3000/reset-password");
console.log("PASS: provider errors, rate limit, custom email link, failed delivery, token verification, expired link, and PKCE callback");
