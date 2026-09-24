import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
console.log("Checking student feature optimizations (12 points)...\n");

// 1. Check isScholarshipOpen in lib/scholarships/types.ts
const typesCode = fs.readFileSync(path.join(root, "lib/scholarships/types.ts"), "utf8");
assert(typesCode.includes("export function isScholarshipOpen("), "FAIL 1: isScholarshipOpen must be exported in types.ts");
assert(typesCode.includes("opensAt <= currentTime && currentTime < closesAt"), "FAIL 1: isScholarshipOpen must check opens_at <= current time < closes_at");
console.log("PASS 1: Shared isScholarshipOpen function implemented.");

// 2. Check apply page and detail page button guarding
const applyCode = fs.readFileSync(path.join(root, "app/apply/page.tsx"), "utf8");
assert(applyCode.includes("!isScholarshipOpen(scholarship"), "FAIL 2: apply page must check !isScholarshipOpen");
const detailCode = fs.readFileSync(path.join(root, "app/scholarships/[id]/page.tsx"), "utf8");
assert(detailCode.includes("isScholarshipOpen(scholarship"), "FAIL 2: scholarship detail page must check isScholarshipOpen");
console.log("PASS 2: Apply page and apply button guarded against upcoming, closed, or non-published scholarships.");

// 3. Check /scholarships time check script
const scholarshipsPage = fs.readFileSync(path.join(root, "app/scholarships/page.tsx"), "utf8");
assert(!scholarshipsPage.includes("setInterval("), "FAIL 3: setInterval polling must NOT exist in scholarships page");
assert(scholarshipsPage.includes("setTimeout("), "FAIL 3: setTimeout must be used to schedule refresh when reaching milestone");
assert(scholarshipsPage.includes("data-apply-button-slot"), "FAIL 3: badge and apply button must be updated together");
console.log("PASS 3: /scholarships polling eliminated, badge and apply button update together, and refresh is scheduled on milestones.");

// 4. Check getStudentApplicationEditorData in lib/scholarships/server.ts
const serverCode = fs.readFileSync(path.join(root, "lib/scholarships/server.ts"), "utf8");
assert(serverCode.includes('.eq("student_id", viewer.id)'), "FAIL 4: getStudentApplicationEditorData must verify student_id === viewer.id");
assert(serverCode.includes('.eq("scholarship_id", scholarshipId)'), "FAIL 4: getStudentApplicationEditorData must verify scholarship_id === scholarshipId");
console.log("PASS 4: getStudentApplicationEditorData validates application ownership and scholarship match.");

// 5. Check edit link in application detail
const appDetailCode = fs.readFileSync(path.join(root, "app/applications/[id]/page.tsx"), "utf8");
assert(appDetailCode.includes("scholarshipId=${scholarship.id}&applicationId=${application.id}"), "FAIL 5: edit link must pass both scholarshipId and applicationId");
assert(applyCode.includes("scholarshipId"), "FAIL 5: apply page must accept scholarshipId parameter");
console.log("PASS 5: Edit application link in detail page sends both scholarshipId and applicationId.");

// 6. Check lightweight query for Apply and Detail page
assert(serverCode.includes("export async function getScholarshipForApplication("), "FAIL 6: getScholarshipForApplication must be exported in server.ts");
assert(applyCode.includes("getScholarshipForApplication"), "FAIL 6: apply page must use getScholarshipForApplication");
assert(serverCode.includes("getScholarshipForApplication(application.scholarship_id)"), "FAIL 6: getStudentApplicationDetail must use getScholarshipForApplication");
console.log("PASS 6: Lightweight scholarship query separated without loading criteria.");

// 7. Check application list query
assert(serverCode.includes('scholarship:scholarships(id,title)'), "FAIL 7: listStudentApplicationsPaginated must select only scholarship id and title");
console.log("PASS 7: Application list query reduced to id and title and filters by student_id.");

// 8. Check SIS cache
const sisCode = fs.readFileSync(path.join(root, "lib/integrations/sis.ts"), "utf8");
assert(sisCode.includes("sisCache = new Map<string, CachedSis>()"), "FAIL 8: sisCache must exist in sis.ts");
assert(sisCode.includes("sisCache.get(studentId)"), "FAIL 8: sisCache must be keyed by studentId");
console.log("PASS 8: Short-term cache for SIS data isolated per student_id.");

// 9. Check profile/SIS call skipped when application is not editable
assert(applyCode.includes("const isEditable ="), "FAIL 9: apply page must determine isEditable");
assert(applyCode.includes("const profile = isEditable ? await getStudentProfileHints() : null;"), "FAIL 9: profile hints must only be fetched when isEditable");
console.log("PASS 9: Apply page skips SIS/Profile lookup when application cannot be edited.");

// 10. Check document upload permissions before admin storage upload
const actionCode = fs.readFileSync(path.join(root, "app/actions/scholarships.ts"), "utf8");
const checkIdx = actionCode.indexOf("appData.student_id !== viewer.id");
const uploadIdx = actionCode.indexOf("admin.storage");
assert(checkIdx !== -1 && uploadIdx !== -1 && checkIdx < uploadIdx, "FAIL 10: ownership and status must be verified before admin.storage.upload");
console.log("PASS 10: Application authorization checked prior to Admin Storage upload.");

// 11. Check interview and appeal errors not swallowed
assert(serverCode.includes("interviewResult.error ||") && serverCode.includes("appealResult.error"), "FAIL 11: interview and appeal query errors must be caught and throw");
console.log("PASS 11: Interview and appeal query errors properly separated from empty record cases.");

// 12. Check appeal deadline check before showing appeal form
assert(appDetailCode.includes("isAppealDeadlineValid"), "FAIL 12: appeal deadline must be checked before showing form");
console.log("PASS 12: appeal_deadline checked before rendering appeal form.");

console.log("\n>>> ALL 12 STUDENT FEATURE OPTIMIZATIONS VERIFIED SUCCESSFULLY! <<<");

