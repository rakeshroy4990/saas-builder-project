# Failure Tracking Runbook

## Event schema

All failure analytics/logs should carry:

- `event_name`
- `domain`: `auth|appointment|video|chat`
- `status`: `success|fail|drop`
- `reason_code`
- `trace_id`
- optional keys: `http_status`, `provider`, `appointment_id`, `call_id`, `duration_sec`

## Extending for new events/failures

Use this checklist whenever adding a new failure mode:

1. Add the new reason key in `frontend-hospital/src/services/observability/telemetrySchema.ts` under the correct domain.
2. Reuse `buildTelemetryEvent(...)` in the service where the failure/success occurs.
3. Emit the same `reason_code` in backend structured log fields for parity.
4. Add/update one dashboard panel and one alert condition if the signal is operationally critical.
5. Add a query snippet in this runbook for quick triage.

This keeps event taxonomy centralized and prevents drift between frontend analytics and backend logs.

## Reason code catalog

- `auth`: `missing_credentials`, `invalid_credentials`, `unauthorized`, `account_inactive`, `request_failed`, `network_error`
- `appointment`: `create_success`, `update_success`, `validation_error`, `age_limit`, `request_failed`, `notification_failed`
- `video`: `call_started`, `call_connected`, `call_dropped`, `stomp_disconnect`, `publish_failed`, `heartbeat_failed`, `session_prep_failed`, `peer_disconnected`
- `chat`: `reply_received`, `escalated_to_human`, `quota_daily`, `provider_429`, `provider_5xx`, `timeout`, `request_failed`

## Dashboard panels and alert thresholds

### 1) Auth health
- Panel: login success vs fail count
- Panel: top `reason_code` for fail
- Alert: fail ratio > 15% for 10m

### 2) Appointment pipeline
- Panel: create/update success count
- Panel: `validation_error` vs `request_failed` trend
- Panel: `notification_failed` count
- Alert: create fail > 5% for 10m

### 3) Video reliability
- Panel: `call_started` vs `call_dropped`
- Panel: top drop reasons (`heartbeat_failed`, `peer_disconnected`, `stomp_disconnect`)
- Alert: drop ratio > 8% for 15m

### 4) AI reliability
- Panel: `reply_received` vs `request_failed`
- Panel: provider split (`provider_429`, `provider_5xx`, `quota_daily`)
- Alert: failure ratio > 10% for 10m or `quota_daily` spike (>20 events in 10m)

## Logs Explorer queries (Cloud Run)

Use these in GCP Logs Explorer with your project filter.

### Login failures
```txt
resource.type="cloud_run_revision"
textPayload:"event_name=login_attempt"
textPayload:"domain=auth"
textPayload:"status=fail"
```

### Appointment create failures
```txt
resource.type="cloud_run_revision"
textPayload:"event_name=appointment_create"
textPayload:"domain=appointment"
textPayload:"status=fail"
```

### Video drops
```txt
resource.type="cloud_run_revision"
textPayload:"event_name=video_call_event"
textPayload:"domain=video"
textPayload:"status=drop"
```

### Chat AI failures
```txt
resource.type="cloud_run_revision"
textPayload:"event_name=chat_ai_request"
textPayload:"domain=chat"
textPayload:"status=fail"
```

## Five-minute RCA workflow

1. From alert, pick top `reason_code` in the last 10-15 minutes.
2. Pull one representative `trace_id` or `call_id`.
3. Pivot into backend logs and UI batched logs (`/api/logs/batch`) for same id.
4. Classify:
   - dependency outage/provider limit
   - network/stomp signaling issue
   - validation/user input issue
   - auth/session/token issue
5. Assign owner and mitigation:
   - frontend service regression
   - backend API regression
   - realtime transport issue
   - third-party provider quota/outage

## One-week baseline and threshold tuning

- Day 1-2: capture baseline p50/p95 fail ratios by domain.
- Day 3-4: adjust noisy reason codes into finer buckets.
- Day 5-7: tune alert thresholds to keep false positives low:
  - target < 2 noisy alerts/day per domain.
- Freeze thresholds in ops docs and revisit every sprint.
