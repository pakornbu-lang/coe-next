import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
console.log("Checking admin reference STALE_VERSION (40001) handling...\n");

// 1. Check app/actions/admin.ts
const adminActions = fs.readFileSync(path.join(root, "app/actions/admin.ts"), "utf8");
assert(
  adminActions.includes('code==="40001" ? "ข้อมูลถูกแก้ไขโดยผู้ใช้อื่น กรุณารีเฟรชหน้าแล้วลองใหม่"'),
  "FAIL: code 40001 in app/actions/admin.ts must return 'ข้อมูลถูกแก้ไขโดยผู้ใช้อื่น กรุณารีเฟรชหน้าแล้วลองใหม่'"
);
console.log("PASS 1: Error 40001 mapped to 'ข้อมูลถูกแก้ไขโดยผู้ใช้อื่น กรุณารีเฟรชหน้าแล้วลองใหม่'.");

// 2. Check components/admin/ReferenceForm.tsx
const refForm = fs.readFileSync(path.join(root, "components/admin/ReferenceForm.tsx"), "utf8");
assert(
  refForm.includes("const isStale ="),
  "FAIL: ReferenceForm must compute isStale"
);
assert(
  refForm.includes("if (isStale) e.preventDefault();"),
  "FAIL: ReferenceForm onSubmit must preventDefault when isStale"
);
assert(
  refForm.includes("disabled={pending || isStale}"),
  "FAIL: Submit button must be disabled when isStale"
);
assert(
  refForm.includes("รีเฟรชข้อมูลล่าสุด"),
  "FAIL: ReferenceForm must provide 'รีเฟรชข้อมูลล่าสุด' button when isStale"
);
assert(
  refForm.includes("router.refresh()"),
  "FAIL: ReferenceForm must call router.refresh() on refresh click & state.success"
);
console.log("PASS 2: ReferenceForm breaks retry loop, disables submission, and offers refresh trigger.");

// 3. Check app/admin/reference/page.tsx
const refPage = fs.readFileSync(path.join(root, "app/admin/reference/page.tsx"), "utf8");
assert(
  refPage.includes('export const dynamic = "force-dynamic"'),
  "FAIL: app/admin/reference/page.tsx must have export const dynamic = 'force-dynamic'"
);
console.log("PASS 3: Reference page set to force-dynamic to always serve latest database versions.");

console.log("\n>>> ALL STALE_VERSION CHECKS PASSED! <<<");
