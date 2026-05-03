# ETL staging load and production cutover

This runbook complements [`MONGO_TO_POSTGRES_INVENTORY.md`](MONGO_TO_POSTGRES_INVENTORY.md). It describes how to load migrated data into Supabase (PostgreSQL), validate parity, switch the hospital API to JDBC, and roll back without rewriting clients.

## Prerequisites

- Supabase project with Postgres connection string (pooler or direct).
- Flyway migrations applied through `V1__baseline_postgres.sql` (and any later versions) on the target database.
- Atlas MongoDB read-only snapshot or export for the cutover window (optional but recommended).

## When Flyway creates tables (backend-hospital)

Flyway is **not** a separate manual step: it runs **automatically when the Spring Boot app starts** in **postgres** persistence mode, applying any pending scripts under `backend-hospital/src/main/resources/db/migration/`.

If you restart with **default mongo mode** (`APP_PERSISTENCE_PROVIDER` unset), `FlexShellApplication` disables Flyway and JDBC auto-configuration, so **nothing is created in Postgres**—that is expected.

To create tables locally:

1. Set **`APP_PERSISTENCE_PROVIDER=postgres`** in the environment (or **`-Dapp.persistence.provider=postgres`** on the JVM command line).
2. Set **`SPRING_DATASOURCE_URL`** to a valid **`jdbc:postgresql://...`** URL (and username/password if not embedded in the URL).
3. Start the app once; check logs for Flyway success and list tables in Supabase SQL editor (`public` schema).

## Environment for PostgreSQL mode

Set before starting the JVM:

| Variable | Purpose |
|----------|---------|
| `APP_PERSISTENCE_PROVIDER=postgres` | Selects JDBC/Flyway/JPA; disables Mongo auto-configuration (see `FlexShellApplication`). |
| `SPRING_DATASOURCE_URL` | JDBC URL to Supabase Postgres. |
| `SPRING_DATASOURCE_USERNAME` / `SPRING_DATASOURCE_PASSWORD` | Database credentials. |

Leave Mongo-related variables unset in pure Postgres mode, or keep Atlas **read-only** during observation if you maintain a fallback.

## Load order (ETL)

1. **Users** (`users`) — primary keys are Mongo `_id` strings carried into `id`; `external_id` is generated or mapped from your UUID mapping table.
2. **Medical departments**, **doctor_schedules** (JSON `weekly`), **appointments** (JSON `prescription_files` as needed).
3. **structured_prescriptions** — preserve encrypted columns (`draft_payload_cipher`, etc.) byte-for-byte if migrating ciphertext.
4. **refresh_tokens**, **sent_emails**, **session_telemetry** (`session_summary` JSONB array).
5. **smart_ai_daily_usage**, **ui_metadata**, **youtube_query_cache**.
6. **Realtime**: `chat_rooms`, `chat_messages`, `chat_acks`, `support_chat_requests`, `call_sessions`, `audit_events`.

Use idempotent batches (`ON CONFLICT` / upserts) keyed by natural or legacy IDs documented in the inventory.

A reference **Python ETL** aligned with `V1__baseline_postgres.sql` lives at [`scripts/etl_mongo_to_pg.py`](../../scripts/etl_mongo_to_pg.py) (`MONGO_URI`, `PG_DSN`, etc.). Extend or replace it as needed. In general, porting “all Mongo data” means:

1. Reads each Mongo collection (or BSON dumps from `mongodump`).
2. Maps fields to the SQL tables and types in `V1__baseline_postgres.sql` (see [`MONGO_TO_POSTGRES_INVENTORY.md`](MONGO_TO_POSTGRES_INVENTORY.md) for collection ↔ table and load order).
3. Writes rows with `INSERT ... ON CONFLICT DO NOTHING/UPDATE` so the job is re-runnable.
4. Preserves Mongo `_id` strings into `users.id`, `appointments.id`, etc., where the schema uses `TEXT` PKs; `external_id` UUIDs default from Postgres where not supplied.

For **pdf-rag-pipeline** Postgres mode, chunk/query-cache/registry data must be **re-ingested** or migrated into `rag_*` tables separately (see that service’s Postgres schema).

## Post-load validation (examples)

Run counts and spot checks:

```sql
SELECT COUNT(*) FROM users WHERE NOT deleted;
SELECT COUNT(*) FROM appointments WHERE NOT deleted;
SELECT COUNT(*) FROM refresh_tokens WHERE NOT deleted;
SELECT COUNT(*) FROM chat_messages WHERE NOT deleted;
```

Compare to Mongo collection counts from the inventory export. Re-verify decrypt paths for structured prescriptions after load.

## Cutover

1. Freeze writes briefly or accept a small maintenance window.
2. Apply final incremental ETL if using dual systems.
3. Deploy the application with `APP_PERSISTENCE_PROVIDER=postgres` and valid datasource env vars.
4. Smoke-test: login/refresh, booking, AI quota (`smart_ai_daily_usage` increment), YouTube cache row upsert, chat/WebRTC flows if used.

## Rollback

1. Set `APP_PERSISTENCE_PROVIDER=mongo` (or omit to default mongo when URI is present).
2. Provide `SPRING_DATA_MONGODB_URI` (or `MONGODB_URL` + password).
3. Redeploy the previous artifact if schema/code drifted.

Mongo adapters (`MongoUserAccess`, `MongoRefreshTokenAccess`, etc.) remain in the codebase for this switch.
