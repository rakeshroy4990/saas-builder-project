# MongoDB → PostgreSQL inventory and ETL order

This document freezes collection-to-table mapping and the order for data migration (FK safety and rollback).

Reference loader: [`scripts/etl_mongo_to_pg.py`](../../scripts/etl_mongo_to_pg.py) (column names match Flyway `V1__baseline_postgres.sql`).

## Core mapping

| MongoDB collection | PostgreSQL table | Primary key / id |
|--------------------|------------------|------------------|
| `users` | `users` | `id` `TEXT` = original MongoDB `_id` (`ObjectId` hex) |
| `refresh_tokens` | `refresh_tokens` | `id` `TEXT` = original `_id` |
| `medical-department` | `medical_departments` | `id` `TEXT` |
| `doctorSchedule` | `doctor_schedules` | `id` `TEXT` |
| `appointment` | `appointments` | `id` `TEXT` |
| `structuredPrescription` | `structured_prescriptions` | `id` `TEXT` |
| `sentEmail` | `sent_emails` | `id` `TEXT` |
| `session_telemetry` | `session_telemetry` | `id` `TEXT` |
| `smart_ai_daily_usage` | `smart_ai_daily_usage` | `id` `TEXT` (composite `userId\|yyyy-MM-dd` as today) |
| `uiMetadata` | `ui_metadata` | `id` `TEXT` (singleton `default`) |
| `query_cache` (db `rag_db` or `APP_YOUTUBE_QUERY_CACHE_DATABASE`) | `youtube_query_cache` | `id` `TEXT` = document `_id` (e.g. `youtube::user::query`) |
| `chat_rooms` | `chat_rooms` | `id` `TEXT` |
| `chat_messages` | `chat_messages` | `id` `TEXT` |
| `chat_acks` | `chat_acks` | `id` `TEXT` |
| `support_chat_requests` | `support_chat_requests` | `id` `TEXT` |
| `call_sessions` | `call_sessions` | `call_id` `TEXT` (PK) |
| `audit_events` | `audit_events` | `id` `TEXT` |

## Optional traceability

- `external_id` `UUID` on `users` and other core tables (API evolution; backfill in ETL or `gen_random_uuid()` for new rows).
- `legacy_mongo_id` is redundant if `id` is the original `_id` string; use a separate `id_mapping` table only if you introduce new string ids before cutover.

## ETL load order (respects foreign references by string id)

1. `users`
2. `medical_departments`
3. `doctor_schedules` (references `doctor_id` → `users.id`)
4. `appointments` (references `doctor_id` / `created_by` as user ids)
5. `structured_prescriptions` (references `appointment_id`, `prescriber_user_id`)
6. `refresh_tokens` (references `user_id` → `users.id`)
7. `sent_emails` (optional `patient_id` / `doctor_id`)
8. `session_telemetry` (`user_id` nullable / anonymous)
9. `smart_ai_daily_usage`
10. `ui_metadata`
11. `youtube_query_cache`
12. Realtime: `chat_rooms`, `chat_messages`, `chat_acks`, `support_chat_requests`, `call_sessions`, `audit_events`

## Nested / unstructured fields

| Location | Strategy |
|----------|----------|
| `DoctorScheduleEntity.Weekly` | `weekly` `JSONB` |
| `AppointmentEntity.PrescriptionFiles` | `prescription_files` `JSONB` |
| `StructuredPrescriptionEntity` draft/signed maps | `JSONB`; ciphertext columns `BYTEA` |
| `StructuredPrescriptionEntity.auditLog` | `JSONB` array |
| `SessionTelemetryEntity` maps + summary | `event_counts`, `flow_counts`, `session_summary` `JSONB` |

## Validation after each stage

- Compare `COUNT(*)` Mongo vs Postgres per table.
- Spot-check newest rows by `updated_at` / `UpdatedTimestamp`.
- For encrypted prescriptions: decrypt round-trip sample rows after load.

## Rollback

- Runtime: set `APP_PERSISTENCE_PROVIDER=mongo` and redeploy (Mongo adapters remain).
- Data: keep Atlas read-only during observation window; re-run ETL idempotently with `ON CONFLICT` where applicable.
