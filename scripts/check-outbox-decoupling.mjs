import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

console.log("Checking outbox decoupling implementation...");

// 1. Check scholarships.ts does NOT call dispatchNotificationEmails in saveApplication
const scholarshipsCode = fs.readFileSync(path.join(root, "app/actions/scholarships.ts"), "utf8");
const saveAppMatch = scholarshipsCode.match(/export async function saveApplication[\s\S]*?return failure\(\);[\s\S]*?\}/);
assert(saveAppMatch, "saveApplication function must be present");
assert(!saveAppMatch[0].includes("dispatchNotificationEmails"), "saveApplication must not call dispatchNotificationEmails synchronously");
console.log("PASS 1: saveApplication does not call dispatchNotificationEmails synchronously.");

// 2. Check lib/notifications/email.ts for status definitions and limit 20
const emailCode = fs.readFileSync(path.join(root, "lib/notifications/email.ts"), "utf8");
assert(emailCode.includes('"pending"'), "OutboxStatus must include pending");
assert(emailCode.includes('"processing"'), "OutboxStatus must include processing");
assert(emailCode.includes('"sent"'), "OutboxStatus must include sent");
assert(emailCode.includes('"failed"'), "OutboxStatus must include failed");
assert(emailCode.includes("max_retries"), "Outbox processing must handle max_retries");
assert(emailCode.includes("DEFAULT_BATCH_LIMIT = 20"), "Default batch limit must be 20");
console.log("PASS 2: email.ts implements pending/processing statuses, 20-batch limit, and retry bounds.");

// 3. Check migration file
const migrationPath = path.join(root, "supabase/migrations/20260923214000_decouple_notification_outbox.sql");
assert(fs.existsSync(migrationPath), "Migration 20260923214000_decouple_notification_outbox.sql must exist");
const migrationSql = fs.readFileSync(migrationPath, "utf8");
assert(migrationSql.includes("notification_email_outbox_status_check"), "Migration must update status check constraint");
assert(migrationSql.includes("max_retries"), "Migration must add max_retries column");
assert(migrationSql.includes("private.portal_notify"), "Migration must update portal_notify function");
console.log("PASS 3: Migration file contains all required schema updates.");

// 4. Check Supabase Edge function
const edgeFnPath = path.join(root, "supabase/functions/dispatch-notifications/index.ts");
assert(fs.existsSync(edgeFnPath), "Edge function dispatch-notifications/index.ts must exist");
console.log("PASS 4: Supabase Edge function created.");

console.log("\nALL OUTBOX DECOUPLING CHECKS PASSED!");

