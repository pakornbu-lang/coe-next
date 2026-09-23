import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
console.log("Checking /applications pagination implementation...");

// 1. Check server.ts
const serverCode = fs.readFileSync(path.join(root, "lib/scholarships/server.ts"), "utf8");
assert(serverCode.includes("listStudentApplicationsPaginated"), "listStudentApplicationsPaginated must be exported");
assert(serverCode.includes("pageSize = 10"), "Default pageSize must be 10");
assert(serverCode.includes(".range(from, to)"), "Must use .range(from, to)");
assert(serverCode.includes('count: "exact"'), 'Must request { count: "exact" }');
assert(serverCode.includes("totalPages"), "Must calculate totalPages");
assert(serverCode.includes("listStudentApplications(): Promise<ApplicationSummary[]>"), "listStudentApplications must remain backward compatible");
console.log("PASS 1: lib/scholarships/server.ts implements range-based pagination with exact count.");

// 2. Check app/applications/page.tsx
const pageCode = fs.readFileSync(path.join(root, "app/applications/page.tsx"), "utf8");
assert(pageCode.includes("searchParams"), "Page must accept searchParams");
assert(pageCode.includes("listStudentApplicationsPaginated"), "Page must call listStudentApplicationsPaginated");
assert(pageCode.includes("ก่อนหน้า"), 'Page must have "ก่อนหน้า" button');
assert(pageCode.includes("ถัดไป"), 'Page must have "ถัดไป" button');
assert(pageCode.includes("/applications?page="), "Pagination controls must link to /applications?page=");
console.log("PASS 2: app/applications/page.tsx handles searchParams and pagination controls.");

// 3. Check CSS
const cssCode = fs.readFileSync(path.join(root, "app/workflow.css"), "utf8");
assert(cssCode.includes(".workflow-pagination"), "workflow.css must include .workflow-pagination");
assert(cssCode.includes(".workflow-pagination-info"), "workflow.css must include .workflow-pagination-info");
assert(cssCode.includes(".workflow-pagination-controls"), "workflow.css must include .workflow-pagination-controls");
console.log("PASS 3: app/workflow.css contains styling for pagination.");

console.log("\nALL PAGINATION CHECKS PASSED!");

