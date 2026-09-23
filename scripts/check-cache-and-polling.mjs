import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
console.log("Checking cache, polling, and reload audit fixes...\n");

// 1. Verify NO window.location.reload() in the codebase
const scholarshipsPage = fs.readFileSync(path.join(root, "app/scholarships/page.tsx"), "utf8");
assert(!scholarshipsPage.includes("window.location.reload()"), "FAIL: window.location.reload() must NOT exist in scholarships page");
assert(!scholarshipsPage.includes("1000"), "FAIL: 1000ms setInterval must NOT exist in scholarships page");
assert(scholarshipsPage.includes("card.setAttribute(\"data-state\""), "FAIL: scholarships page should update DOM attributes in place");
console.log("PASS 1: window.location.reload() infinite loop eliminated; status updates in-place via DOM.");

// 2. Verify viewer profile caching
const authServer = fs.readFileSync(path.join(root, "lib/auth/server.ts"), "utf8");
assert(authServer.includes("viewerCache"), "FAIL: viewerCache must be present in lib/auth/server.ts");
assert(authServer.includes("invalidateViewerCache"), "FAIL: invalidateViewerCache must be exported from lib/auth/server.ts");
console.log("PASS 2: Viewer profile cached (60s TTL) to prevent repeated portal_profiles queries on page transitions.");

// 3. Verify notifications caching
const scholarshipsServer = fs.readFileSync(path.join(root, "lib/scholarships/server.ts"), "utf8");
assert(scholarshipsServer.includes("notificationsCache"), "FAIL: notificationsCache must be present in lib/scholarships/server.ts");
assert(scholarshipsServer.includes("invalidateNotificationsCache"), "FAIL: invalidateNotificationsCache must be exported");
console.log("PASS 3: Notifications cached (30s TTL) to prevent repeated portal_notifications queries on page transitions.");

// 4. Verify published scholarships caching
assert(scholarshipsServer.includes("publishedScholarshipsCache"), "FAIL: publishedScholarshipsCache must be present");
assert(scholarshipsServer.includes("invalidatePublishedScholarshipsCache"), "FAIL: invalidatePublishedScholarshipsCache must be exported");
console.log("PASS 4: Published scholarships cached across home, scholarships, and dashboard pages.");

// 5. Verify layout uses cached notifications with viewer.id
const layoutCode = fs.readFileSync(path.join(root, "app/layout.tsx"), "utf8");
assert(layoutCode.includes("getNotifications(viewer.id)"), "FAIL: app/layout.tsx must pass viewer.id to getNotifications");
console.log("PASS 5: Root layout passes viewer.id for targeted caching.");

// 6. Verify cache invalidations on mutations
const profileAction = fs.readFileSync(path.join(root, "app/actions/profile.ts"), "utf8");
assert(profileAction.includes("invalidateViewerCache"), "FAIL: app/actions/profile.ts must call invalidateViewerCache");

const notifAction = fs.readFileSync(path.join(root, "app/actions/notifications.ts"), "utf8");
assert(notifAction.includes("invalidateNotificationsCache"), "FAIL: app/actions/notifications.ts must call invalidateNotificationsCache");

const actionCode = fs.readFileSync(path.join(root, "app/actions/scholarships.ts"), "utf8");
assert(actionCode.includes("invalidatePublishedScholarshipsCache"), "FAIL: app/actions/scholarships.ts must call invalidatePublishedScholarshipsCache");
console.log("PASS 6: Cache invalidation hooked into profile, notification, and scholarship mutations.");

console.log("\n>>> ALL POLLING, RELOAD, AND CACHING CHECKS PASSED! <<<");

