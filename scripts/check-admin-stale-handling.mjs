import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

console.log("Checking admin STALE_VERSION (40001) handling...\n");

// ============================================================
// 1. Check app/actions/admin.ts
// ============================================================

const adminActions = fs.readFileSync(
  path.join(root, "app/actions/admin.ts"),
  "utf8",
);

assert(
  adminActions.includes(
    'code==="40001" ? "ข้อมูลถูกแก้ไขโดยผู้ใช้อื่น กรุณารีเฟรชหน้าแล้วลองใหม่"',
  ),
  "FAIL: code 40001 in app/actions/admin.ts must return 'ข้อมูลถูกแก้ไขโดยผู้ใช้อื่น กรุณารีเฟรชหน้าแล้วลองใหม่'",
);

console.log(
  "PASS 1: Error 40001 mapped to 'ข้อมูลถูกแก้ไขโดยผู้ใช้อื่น กรุณารีเฟรชหน้าแล้วลองใหม่'.",
);

// ============================================================
// 2. Check components/admin/ReferenceForm.tsx
// ============================================================

const refForm = fs.readFileSync(
  path.join(root, "components/admin/ReferenceForm.tsx"),
  "utf8",
);

assert(
  refForm.includes("const isStale ="),
  "FAIL: ReferenceForm must compute isStale",
);

assert(
  refForm.includes("if (isStale) e.preventDefault();"),
  "FAIL: ReferenceForm onSubmit must preventDefault when isStale",
);

assert(
  refForm.includes("disabled={pending || isStale}"),
  "FAIL: ReferenceForm submit button must be disabled when isStale",
);

assert(
  refForm.includes("รีเฟรชข้อมูลล่าสุด"),
  "FAIL: ReferenceForm must provide 'รีเฟรชข้อมูลล่าสุด' button when isStale",
);

assert(
  refForm.includes("router.refresh()"),
  "FAIL: ReferenceForm must call router.refresh()",
);

console.log(
  "PASS 2: ReferenceForm breaks retry loop, disables submission, and offers refresh trigger.",
);

// ============================================================
// 3. Check app/admin/reference/page.tsx
// ============================================================

const refPage = fs.readFileSync(
  path.join(root, "app/admin/reference/page.tsx"),
  "utf8",
);

assert(
  refPage.includes('export const dynamic = "force-dynamic"'),
  "FAIL: app/admin/reference/page.tsx must have export const dynamic = 'force-dynamic'",
);

console.log(
  "PASS 3: Reference page set to force-dynamic to always serve latest database versions.",
);

// ============================================================
// 4. Check components/admin/MemberManager.tsx
// ============================================================

const memberManager = fs.readFileSync(
  path.join(root, "components/admin/MemberManager.tsx"),
  "utf8",
);

// ต้องใช้ router.refresh()
assert(
  memberManager.includes(
    'import { useRouter } from "next/navigation"',
  ),
  "FAIL: MemberManager must import useRouter from next/navigation",
);

// ต้องตรวจ stale version
assert(
  memberManager.includes("const isStale ="),
  "FAIL: MemberManager must compute isStale",
);

// ต้องตรวจข้อความ STALE_VERSION
assert(
  memberManager.includes(
    'state.error.includes("ข้อมูลถูกแก้ไขโดยผู้ใช้อื่น")',
  ),
  "FAIL: MemberManager must detect stale-version error message",
);

// ต้องหยุด submit เมื่อข้อมูล stale หรือบันทึกสำเร็จแล้ว
assert(
  memberManager.includes(
    "if (isStale || state.success)",
  ),
  "FAIL: MemberManager must stop stale or repeated successful submissions",
);

// ต้อง disable input/select/button เมื่อ stale
assert(
  memberManager.includes(
    "disabled={pending || isStale || Boolean(state.success)}",
  ),
  "FAIL: MemberManager controls must be disabled when stale, pending, or already successful",
);

// ต้องมีปุ่มให้ refresh
assert(
  memberManager.includes("รีเฟรชข้อมูลล่าสุด"),
  "FAIL: MemberManager must provide 'รีเฟรชข้อมูลล่าสุด' button",
);

// ต้อง refresh หลังบันทึกสำเร็จหรือเมื่อกด refresh
assert(
  memberManager.includes("router.refresh()"),
  "FAIL: MemberManager must call router.refresh()",
);

// key ต้องมี version เพื่อ reset local state หลังข้อมูลเปลี่ยน
assert(
  memberManager.includes(
    'key={`${member.id}:${member.version}`}',
  ),
  "FAIL: MemberCard key must include member.id and member.version",
);

// ต้องใช้ useEffect เพื่อ refresh หลัง success
assert(
  memberManager.includes("useEffect(() =>"),
  "FAIL: MemberManager must use useEffect for refresh after successful update",
);

console.log(
  "PASS 4: MemberManager blocks stale submissions, disables stale form controls, refreshes latest data, and resets local state when version changes.",
);

// ============================================================
// Final result
// ============================================================

console.log(
  "\n>>> ALL ADMIN STALE_VERSION CHECKS PASSED! <<<",
);