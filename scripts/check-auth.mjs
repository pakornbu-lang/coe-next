// Run against the configured Supabase project and a running local Next.js server.
// Supply an array of { email, password, role } via stdin. Credentials are never logged.
import assert from "node:assert/strict";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

let input = "";
for await (const chunk of process.stdin) input += chunk;
const accounts = JSON.parse(input);
input = "";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
assert(url && key, "Load .env.local before running this check");
const base = process.env.AUTH_TEST_BASE_URL ?? "http://localhost:3000";
const routeRoles = {
  "/admin": "admin", "/admin/reference": "admin", "/admin/audit": "admin",
  "/dashboard": "student", "/applications": "student", "/apply": "student",
  "/staff": "staff", "/staff/scholarships": "staff", "/staff/review": "staff", "/scholarships/new": "staff",
  "/committee": "committee", "/staff/evaluation": "committee",
};
const homes = { admin: "/admin", student: "/dashboard", staff: "/staff", committee: "/committee" };
assert.deepEqual(accounts.map(a => a.role).sort(), ["admin", "committee", "staff", "student"]);
const anonymous = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const anonymousProfiles = await anonymous.from("portal_profiles").select("id");
assert(anonymousProfiles.error, "Anonymous users must not read account profiles");
for (const route of Object.keys(routeRoles)) {
  const response = await fetch(base + route, { redirect: "manual" });
  assert.equal(response.status, 307, "Anonymous route should redirect: " + route);
  assert.equal(new URL(response.headers.get("location"), base).pathname, "/login");
  await response.body?.cancel();
}
console.log("PASS: anonymous database and protected-route access denied");

for (const account of accounts) {
  const jar = new Map();
  const client = createServerClient(url, key, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (cookies) => cookies.forEach(c => jar.set(c.name, c.value)),
    },
  });
  try {
    const { error } = await client.auth.signInWithPassword({ email: account.email, password: account.password });
    account.password = "";
    assert.equal(error, null, "Login should succeed for " + account.role);
    const { data: { user } } = await client.auth.getUser();
    assert(user);
    const { data: profiles, error: profileError } = await client.from("portal_profiles").select("id,role,full_name");
    assert.equal(profileError, null);
    if (["student", "committee"].includes(account.role)) {
      assert.equal(profiles.length, 1, "Students and committee members must read only their own profile");
    } else if (account.role === "staff") {
      assert(profiles.length >= 1, "Staff must read their own profile");
      assert(profiles.every(profile => profile.id === user.id || profile.role === "committee"), "Staff may additionally read only committee profiles for assignment");
    } else {
      assert(profiles.length >= 4, "Admin must read member accounts");
    }
    profiles.sort((a,b) => Number(b.id === user.id) - Number(a.id === user.id));
    assert.equal(profiles[0].id, user.id);
    assert.equal(profiles[0].role, account.role);
    const attemptedRole = account.role === "staff" ? "committee" : "staff";
    const change = await client.from("portal_profiles").update({ role: attemptedRole }).eq("id", user.id);
    assert(change.error, "Clients must not change roles, including their own");
    const cookie = [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
    for (const [route, allowed] of Object.entries(routeRoles)) {
      const response = await fetch(base + route, {
        redirect: "manual",
        // These untrusted hints must never override the verified account role.
        headers: { cookie, "x-user-role": allowed, "x-user-id": "untrusted-test-id" },
      });
      const expected = account.role === allowed ? 200 : 307;
      assert.equal(response.status, expected, `${account.role}: ${route}`);
      if (expected === 307) {
        assert.equal(new URL(response.headers.get("location"), base).pathname, "/access-denied");
        await response.body?.cancel();
      } else {
        const html = await response.text();
        assert(html.includes(profiles[0].full_name), "Page must show the signed-in account's name");
        assert.match(response.headers.get("cache-control") ?? "", /no-store/);
      }
    }
    const loginPage = await fetch(base + "/login", { headers: { cookie }, redirect: "manual" });
    assert.equal(loginPage.status, 307);
    assert.equal(new URL(loginPage.headers.get("location"), base).pathname, homes[account.role]);
    await loginPage.body?.cancel();
    console.log(`PASS: ${account.role} login, identity, RLS, immutable role and all route permissions`);
  } finally {
    account.password = "";
    await client.auth.signOut({ scope: "local" });
  }
}
