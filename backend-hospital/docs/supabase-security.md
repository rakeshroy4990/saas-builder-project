# Supabase security (PostgreSQL + Storage)

Agastya uses **Supabase-hosted PostgreSQL** for JDBC (Spring Boot / Flyway) and **S3-compatible storage** for prescription files. The Vue app does **not** use the Supabase JS client or the `anon` API key.

## Why Supabase reports “public tables”

Supabase exposes the `public` schema through **PostgREST** to roles `anon` and `authenticated`. Any table **without Row Level Security (RLS)** is readable/writable by anyone who has your project URL and the **anon** key (e.g. from leaked frontend env or Dashboard).

That is separate from your backend: Spring connects with the **database password** (pooler URL) and is not limited by RLS when using the `postgres` role.

## Fix applied in this repo

Flyway migration **`V12__enable_row_level_security.sql`**:

1. **V12** — Enables **RLS** on every ordinary table in `public` except `flyway_schema_history` (Flyway locks that table during V12).
2. **V12** — **Revokes** `SELECT` / `INSERT` / `UPDATE` / `DELETE` from `anon`, `authenticated`, and `PUBLIC` on those tables.
3. **V13** — Secures **`rag_ingest_jobs` / `rag_ingest_batches` views** (revoke + `security_invoker`). Does **not** touch `flyway_schema_history` (Flyway locks it during migrate).
4. **`scripts/supabase-lockdown-flyway-history.sql`** — Run manually in SQL Editor when the app is stopped to RLS-lock `flyway_schema_history`.
5. Sets **default privileges** so future Flyway tables stay locked down.

With RLS on and **no permissive policies** for `anon` / `authenticated`, the Data API returns no rows (deny-by-default). The hospital API continues to work over JDBC.

### Apply to an existing project

1. If **V13 failed** and the app will not start: in Supabase SQL Editor run  
   `DELETE FROM flyway_schema_history WHERE version = '13' AND success = false;`  
   then redeploy (or `./gradlew flywayRepair` against the same database).
2. Deploy/run backend so Flyway applies **V12** and **V13**.
3. With the app **stopped**, run **`scripts/supabase-lockdown-flyway-history.sql`** in SQL Editor (optional Security Advisor cleanup).
4. Restart **pdf-rag-pipeline** once so alias views get `security_invoker` + revoke.
5. Re-run Supabase **Security Advisor**.

## What you must not do

| Risk | Mitigation |
|------|------------|
| `anon` / `service_role` keys in the Vue app | Never add `@supabase/supabase-js` with project keys in `frontend-hospital`. |
| `SUPABASE_SERVICE_KEY` in the browser | Backend only (`cloudrun-env.yaml` / Secret Manager). |
| Public storage buckets for prescriptions | Keep bucket **private**; use signed URLs from Spring (`app.supabase.signed-url-ttl-seconds`). |
| Disabling RLS on a table “to test” | Re-enable RLS and fix backend access instead. |

## Storage (not the same as table RLS)

Prescription files use **S3 API** credentials (`SUPABASE_S3_ACCESS_KEY` / `SECRET`). In Dashboard → **Storage** → bucket `prescription` (or your `PRESCRIPTION_STORAGE_BUCKET`):

- Bucket should be **private** (not public).
- Do not add policies that allow anonymous `SELECT` on patient objects.

## Optional hardening

- Rotate **database password** and S3 keys if anon key or service role was ever committed.
- Restrict **Network** / IP allowlists on Supabase if your deployment has fixed egress IPs.
- Use **separate** Supabase projects for production vs development.

## References

- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase API keys](https://supabase.com/docs/guides/api/api-keys)
