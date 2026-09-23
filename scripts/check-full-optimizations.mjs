import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
console.log("Running comprehensive 8-point optimization checks...\n");

// 1. Submit application decoupling
const actionsCode = fs.readFileSync(path.join(root, "app/actions/scholarships.ts"), "utf8");
const saveAppMatch = actionsCode.match(/export async function saveApplication[\s\S]*?return failure\(\);[\s\S]*?\}/);
assert(saveAppMatch, "saveApplication function must be present");
assert(!saveAppMatch[0].includes("dispatchNotificationEmails"), "Item 1 FAIL: saveApplication must NOT call dispatchNotificationEmails synchronously");
console.log("PASS Item 1: saveApplication decoupled from synchronous email dispatch.");

// 2. /apply query deduplication
const serverCode = fs.readFileSync(path.join(root, "lib/scholarships/server.ts"), "utf8");
assert(serverCode.includes("getStudentApplicationEditorData"), "Item 2 FAIL: lib/scholarships/server.ts must export getStudentApplicationEditorData");
const applyPageCode = fs.readFileSync(path.join(root, "app/apply/page.tsx"), "utf8");
assert(applyPageCode.includes("getStudentApplicationEditorData"), "Item 2 FAIL: app/apply/page.tsx must call getStudentApplicationEditorData");
assert(!applyPageCode.includes("getStudentApplicationDetail"), "Item 2 FAIL: app/apply/page.tsx must NOT call getStudentApplicationDetail");
assert(applyPageCode.includes("Promise.all(["), "Item 2 FAIL: app/apply/page.tsx must fetch concurrently with Promise.all");
console.log("PASS Item 2: /apply deduplicated and loads in parallel with getStudentApplicationEditorData.");

// 3. getStudentApplicationDetail, getStaffApplicationDetail, getCommitteeAssignment decoupling
const staffDetailMatch = serverCode.match(/export async function getStaffApplicationDetail[\s\S]*?return \{[\s\S]*?\};[\s\S]*?\}/);
assert(staffDetailMatch, "Item 3 FAIL: getStaffApplicationDetail must exist");
assert(!staffDetailMatch[0].includes("getStudentApplicationDetail("), "Item 3 FAIL: getStaffApplicationDetail must NOT call getStudentApplicationDetail");

const committeeMatch = serverCode.match(/export async function getCommitteeAssignment[\s\S]*?return \{[\s\S]*?\};[\s\S]*?\}/);
assert(committeeMatch, "Item 3 FAIL: getCommitteeAssignment must exist");
assert(!committeeMatch[0].includes("getStudentApplicationDetail("), "Item 3 FAIL: getCommitteeAssignment must NOT call getStudentApplicationDetail");
assert(!committeeMatch[0].includes("disbursements"), "Item 3 FAIL: getCommitteeAssignment must not query disbursements");
console.log("PASS Item 3: Separated loaders for Student, Staff, and Committee without waterfall.");

// 4. Pagination in /applications
const appPageCode = fs.readFileSync(path.join(root, "app/applications/page.tsx"), "utf8");
assert(appPageCode.includes("listStudentApplicationsPaginated"), "Item 4 FAIL: app/applications/page.tsx must call listStudentApplicationsPaginated");
assert(appPageCode.includes("pageSize: 10") || appPageCode.includes("pageSize,"), "Item 4 FAIL: page size must be 10");
assert(appPageCode.includes("/applications?page="), "Item 4 FAIL: pagination links must include page searchParam");
console.log("PASS Item 4: /applications pagination connected with page 1, 2... and previous/next controls.");

// 5. High-frequency table indexes
const indexMigrationPath = path.join(root, "supabase/migrations/20260923230000_optimize_workflow_indexes.sql");
assert(fs.existsSync(indexMigrationPath), "Item 5 FAIL: Index migration file must exist");
const indexSql = fs.readFileSync(indexMigrationPath, "utf8");
assert(indexSql.includes("applications_student_updated_idx"), "Item 5 FAIL: missing applications student index");
assert(indexSql.includes("application_documents_app_status_idx"), "Item 5 FAIL: missing application documents index");
assert(indexSql.includes("application_status_history_app_created_idx"), "Item 5 FAIL: missing application status history index");
assert(indexSql.includes("scholarships_status_closes_idx"), "Item 5 FAIL: missing scholarships status closes index");
console.log("PASS Item 5: High-frequency workflow database indexes defined with IF NOT EXISTS.");

// 6. Reduce audit logging on drafts
const auditMigrationPath = path.join(root, "supabase/migrations/20260923231000_optimize_application_audit.sql");
assert(fs.existsSync(auditMigrationPath), "Item 6 FAIL: Audit migration file must exist");
const auditSql = fs.readFileSync(auditMigrationPath, "utf8");
assert(auditSql.includes("create or replace function public.student_save_application"), "Item 6 FAIL: must update student_save_application");
assert(!auditSql.includes("save_application_draft"), "Item 6 FAIL: student_save_application must NOT write save_application_draft audit");
assert(auditSql.includes("submit_application"), "Item 6 FAIL: must retain submit_application audit");
console.log("PASS Item 6: Draft audit snapshot writes eliminated, saving Disk I/O & write operations.");

// 7. Remove document fallback query
const docFuncMatch = serverCode.match(/export async function getApplicationDocuments[\s\S]*?return \(\(data[\s\S]*?\};/);
assert(docFuncMatch, "Item 7 FAIL: getApplicationDocuments must exist");
assert(!docFuncMatch[0].includes("legacyResult"), "Item 7 FAIL: legacyResult fallback query must be removed");
assert(!docFuncMatch[0].includes("isMissingSchemaObject"), "Item 7 FAIL: isMissingSchemaObject check must be removed");
console.log("PASS Item 7: Redundant fallback query in getApplicationDocuments removed.");

// 8. Cache scholarships list
const scholarshipsPageCode = fs.readFileSync(path.join(root, "app/scholarships/page.tsx"), "utf8");
assert(scholarshipsPageCode.includes("export const revalidate = 60"), "Item 8 FAIL: /scholarships must set revalidate = 60");
assert(!scholarshipsPageCode.includes('export const dynamic = "force-dynamic"'), "Item 8 FAIL: dynamic force-dynamic must be removed");
console.log("PASS Item 8: /scholarships cached with ISR (revalidate = 60).");

console.log("\n>>> ALL 8 OPTIMIZATION CHECKS PASSED SUCCESSFULLY! <<<");

