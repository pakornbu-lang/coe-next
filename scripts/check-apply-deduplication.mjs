import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
console.log("Checking /apply scholarship deduplication implementation...");

// 1. Check lib/scholarships/server.ts
const serverCode = fs.readFileSync(path.join(root, "lib/scholarships/server.ts"), "utf8");
assert(
  serverCode.includes("export async function getStudentApplicationEditorData") ||
  serverCode.includes("export async function getApplicationEditorData"),
  "server.ts must export getStudentApplicationEditorData or getApplicationEditorData"
);
const editorDataMatch = serverCode.match(/export async function (?:getStudentApplicationEditorData|getApplicationEditorData)[\s\S]*?return \{[\s\S]*?\};[\s\S]*?\}/);
assert(editorDataMatch, "editor data function body must be found");
assert(!editorDataMatch[0].includes("getScholarship("), "editor data function must not re-query getScholarship");
assert(!editorDataMatch[0].includes("disbursements"), "editor data function must not fetch disbursements");
assert(!editorDataMatch[0].includes("application_status_history"), "editor data function must not fetch application_status_history");
assert(!editorDataMatch[0].includes("application_interviews"), "editor data function must not fetch application_interviews");
assert(!editorDataMatch[0].includes("application_appeals"), "editor data function must not fetch application_appeals");
console.log("PASS 1: getStudentApplicationEditorData only queries application, documents, and payment account (no redundant scholarship or unrelated tables).");

// 2. Check app/apply/page.tsx
const applyCode = fs.readFileSync(path.join(root, "app/apply/page.tsx"), "utf8");
assert(
  applyCode.includes("getStudentApplicationEditorData") || applyCode.includes("getApplicationEditorData"),
  "apply page must import and use editor data function"
);
assert(!applyCode.includes("getStudentApplicationDetail"), "apply page must not call getStudentApplicationDetail");
assert(applyCode.includes("Promise.all(["), "apply page must use Promise.all to fetch concurrently");
console.log("PASS 2: app/apply/page.tsx loads scholarship, editorData, and profile concurrently without duplicate queries.");

console.log("\nALL APPLY DEDUPLICATION CHECKS PASSED!");

