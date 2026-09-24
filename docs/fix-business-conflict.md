# Fix STALE_VERSION retry loops

The custom SQLSTATE 40001 on stale data tells PostgREST to retry a transaction.
This patch uses PT409 (HTTP conflict) for the two known business messages.
Actual PostgreSQL serialization errors remain unchanged.

## Apply

1. Open supabase/migrations/20260924030000_fix_business_conflict_sqlstate.sql.
2. In the intended Supabase project, open SQL Editor > New query.
3. Paste and run the entire file. The transaction changes only the exception
   codes in the 12 existing function definitions. No rows are deleted and
   signatures, owners, privileges, security-definer settings and other logic stay.
4. Run supabase/tests/verify_business_conflict_sqlstate.sql.
   Expect 12 handlers using PT409 and none of these business handlers using 40001.
5. Deploy/restart the web application with the updated action handlers.

If the migration reports a missing, overloaded, or unexpected function, the whole
transaction aborts. Do not remove the checks; inspect the actual function first.
Historical migrations are intentionally unchanged. A fresh database applies this
new migration last. The migration is safe to rerun.

Changing the functions does not stop an already-running retry loop. Inspect the
latest Postgres logs for 40001 and match process_id with the current
pg_stat_activity.pid. Stop only a verified looping backend. Do not terminate
sessions based on historical IDs or terminate all database sessions.

## Validation

- node scripts/check-business-conflict-sqlstate.cjs
  requires @electric-sql/pglite or PGLITE_MODULE pointing to an isolated install.
- The test extracts the actual exception statements from the latest local
  definitions, runs them inside minimal PostgreSQL fixture functions, and tests
  PT409, unchanged successful returns, preserved function metadata/grants,
  genuine 40001 retention, repeat application and transactional rollback.
- TypeScript and ESLint validate the five updated server-action files.
- No live stale-version RPC is called before SQL verification: that could restart
  the retry loop.

Source:
https://supabase.com/docs/guides/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions-77326b
