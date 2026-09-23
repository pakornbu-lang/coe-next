// Isolated API/action tests. No network, database writes, or email.
const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const ts = require("typescript");
function load(file, imports) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { exports, require: name => {
    if (!(name in imports)) throw new Error("Unexpected import: " + name);
    return imports[name];
  }, Response, Request, URL });
  return exports;
}
(async () => {
  let viewer = null, calls = 0, fail = false;
  const api = load("app/api/student/notifications/route.ts", {
    "@/lib/auth/server": { getViewer: async () => viewer },
    "@/lib/notifications/student": { getStudentNotifications: async (id, page, unread) => {
      calls++; assert.equal(id, "student-A");
      if (fail) throw new Error("private database detail");
      return { items: [], page, unread: unread ? 2 : 0, total: 0 };
    } },
  });
  const get = query => api.GET(new Request("http://localhost/api/student/notifications" + query));
  assert.equal((await get("")).status, 401);
  for (const role of ["staff", "admin", "committee"]) {
    viewer = { id: "other", role };
    assert.equal((await get("")).status, 403);
  }
  assert.equal(calls, 0);
  viewer = { id: "student-A", role: "student" };
  for (const value of ["0", "-1", "1.5", "NaN", "100001"]) {
    assert.equal((await get("?page=" + value)).status, 400);
  }
  const response = await get("?page=10000&unread=true&user_id=someone-else");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control"), /no-store/);
  assert.equal((await response.json()).page, 10000);
  fail = true;
  const failure = await get("");
  assert.equal(failure.status, 503);
  assert.ok(!(await failure.text()).includes("private database"));

  let allowed = true, rpcCalls = [], rpcError = null, invalidations = 0;
  const actions = load("app/actions/student-notifications.ts", {
    "@/lib/auth/server": { requireRole: async roles => {
      assert.equal(roles.join(","), "student");
      if (!allowed) throw new Error("denied");
    } },
    "@/lib/supabase/server": { createClient: async () => ({ rpc: async (...args) => {
      rpcCalls.push(args); return { error: rpcError };
    } }) },
    "next/cache": { revalidatePath: () => invalidations++ },
  });
  await actions.readStudentNotification("invalid");
  assert.equal(rpcCalls.length, 0);
  assert.equal((await actions.readStudentNotification()).error, "");
  assert.equal(rpcCalls[0][0], "mark_all_my_student_notifications_read");
  assert.equal(rpcCalls[0].length, 1); // User ID must come from auth.uid(), never the browser.
  rpcError = { message: "failure" };
  assert.ok((await actions.readStudentNotification("12345678-1234-4123-8123-123456789abc")).error);
  assert.equal(invalidations, 1);
  allowed = false;
  await assert.rejects(() => actions.readStudentNotification(), /denied/);
  assert.equal(rpcCalls.length, 2);

  const queries = [];
  const service = load("lib/notifications/student.ts", {
    "server-only": {},
    "@/lib/supabase/server": { createClient: async () => ({ from: table => {
      assert.equal(table, "portal_notifications");
      const q = {
        filters: [], head: false,
        select(_fields, options) { this.head = !!options?.head; return this; },
        eq(key, value) { this.filters.push([key, value]); return this; },
        is() { return this; }, order() { return this; },
        range() { throw new Error("Out-of-range pages must not query a range"); },
        then(resolve) {
          assert.ok(this.filters.some(([key, value]) => key === "user_id" && value === "student-A"));
          resolve({ count: 1, error: null });
        },
      };
      queries.push(q); return q;
    } }) },
  });
  const empty = await service.getStudentNotifications("student-A", 10000, false);
  assert.equal(empty.items.length, 0);
  assert.equal(empty.unread, 1);
  assert.equal(queries.length, 3);
  console.log("PASS: authentication, roles, paging, cache isolation, RPC failures, read-all identity, own-user queries.");
})().catch(error => { console.error(error); process.exitCode = 1; });
