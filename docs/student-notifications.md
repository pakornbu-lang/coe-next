# Student notifications

Implemented in Desktop/coe-next: student-only /notifications, GET
/api/student/notifications?page=1&unread=true, the student bell, single-read and
read-all actions. Lists use 20 items per page; unread count covers all owned rows.
The bell loads on opening; refresh is manual to avoid background database load.
Other roles keep their existing notification menu and email dispatcher.

## Database setup

Run the entire supabase/migrations/20260924010000_student_notification_read_all.sql
in the project's Supabase SQL Editor. It is safe to rerun if the older student
read-all function is already installed. Existing notification tables, RLS and the
mark_my_notification_read RPC from the team's migrations are required.
The new RPC requires an active student and updates only auth.uid()'s unread rows.
It does not send email or change application status.

Configure this clone's .env.local using .env.example and the project's settings.
Do not commit credentials. Run npm run dev, sign in as a student, and open
/notifications or the bell.

## Verification

- node scripts/check-student-notifications.cjs (isolated mocks; no live DB)
- npx tsc --noEmit
- Check real student notifications, open details, mark one read, then read all.
- Reload: read states must persist. Another student's rows must remain unchanged.
- Staff/committee/admin must not access the student page/API or read-all RPC.
- Confirm empty lists, more than 20 records, unread filter and network failures.
- No live Supabase validation is implied by the mock checks.
