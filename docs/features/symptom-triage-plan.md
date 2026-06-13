# Pediatric Symptom Triage — Implementation Plan

**Status:** Design locked · Ready for implementation  
**Last updated:** 2026-06-13

Parent-facing symptom triage before booking or joining a video call. Collects child profile + symptoms, calls RAG-backed LLM via `pdf-rag-pipeline`, persists result in PostgreSQL, surfaces urgency to parent and pre-consultation note to doctor.

---

## Locked product decisions

| # | Decision | Choice |
|---|----------|--------|
| 1 | Video-call gate | **Soft block** — prompt parent if no recent triage; allow skip and proceed to call |
| 2 | Child name storage | **`child_display_name`** column on `triage_results` (not embedded in `doctor_note` only) |
| 3 | Re-triage | **Allowed within 24h** — new analyze creates a new row; latest row wins for display/linking |
| 4 | RAG corpus | **No mandatory book filter** — retrieve against whatever books are ingested; no hard dependency on Nelson/pediatric-only catalog |

---

## Architecture fit

| Concern | Agastya convention |
|---------|-------------------|
| Schema | Flyway `V23__triage_results.sql` in `backend-hospital` |
| IDs | Business key `external_id UUID`; appointment FK → `appointments(external_id)` |
| Patient FK | `patient_user_id TEXT REFERENCES users(id)` |
| RLS | V12 blanket lockdown; auth via Spring JWT (`@PreAuthorize`) |
| FastAPI | Internal only — `pdf-rag-pipeline/api/routes/triage.py` at `POST /api/v1/triage/analyze` |
| Public API | Spring `POST /api/v1/triage-results/analyze` (browser never calls pdf-rag directly) |
| Wire JSON | PascalCase (`ChildAgeMonths`, `UrgencyLevel`, …) |
| RAG bridge | Extend `PdfRagQueryAdapter` pattern → `PdfRagTriageAdapter` |
| Config | Reuse `app.ai.rag.base-url`; add `app.ai.rag.triage-path` |

---

## Data flow

```
Parent (web/mobile)
  → POST /api/v1/triage-results/analyze (Spring, JWT)
      → POST /api/v1/triage/analyze (pdf-rag-pipeline)
          → HyDE query → retrieve chunks (all ingested books, top_k=8)
          → LLM (gpt-4o-mini) + validate_triage_response()
      → INSERT triage_results
  → Parent sees urgency card
  → On booking: POST appointment with TriageResultExternalId → link row + merge doctor_note into additional_notes
  → Doctor sees DynTriageResultBadge on appointment row
```

---

## Phase 1 — Database (`V23__triage_results.sql`)

```sql
CREATE TABLE triage_results (
    id                      BIGSERIAL PRIMARY KEY,
    external_id             UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    appointment_external_id UUID REFERENCES appointments (external_id),
    patient_user_id         TEXT NOT NULL REFERENCES users (id),
    child_display_name      TEXT,
    child_age_months        INTEGER NOT NULL,
    child_weight_kg         NUMERIC(5,2),
    reported_symptoms       TEXT[] NOT NULL,
    symptom_duration_hours  INTEGER,
    symptom_severity        TEXT NOT NULL
        CHECK (symptom_severity IN ('MILD','MODERATE','SEVERE')),
    additional_notes        TEXT,
    urgency_level           TEXT NOT NULL
        CHECK (urgency_level IN ('HOME_CARE','CLINIC_VISIT','EMERGENCY')),
    urgency_reasoning       TEXT NOT NULL,
    doctor_note             TEXT NOT NULL,
    red_flags               TEXT[] NOT NULL DEFAULT '{}',
    confidence              TEXT CHECK (confidence IN ('LOW','MEDIUM','HIGH')),
    model_used              TEXT,
    rag_chunks_used         JSONB,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted                 BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_triage_results_appointment ON triage_results (appointment_external_id)
    WHERE deleted = false;
CREATE INDEX idx_triage_results_patient ON triage_results (patient_user_id)
    WHERE deleted = false;
CREATE INDEX idx_triage_results_patient_created ON triage_results (patient_user_id, created_at DESC)
    WHERE deleted = false;
```

**Re-triage rule (application layer):** Multiple rows per `(patient_user_id, appointment_external_id)` allowed. Read path uses `ORDER BY created_at DESC LIMIT 1`. Rows older than 24h are stale for soft-block purposes (see Phase 4/5).

---

## Phase 2 — FastAPI (`pdf-rag-pipeline/api/routes/triage.py`)

**Endpoint:** `POST /api/v1/triage/analyze`

**Request (PascalCase):** `ChildAgeMonths`, `ChildWeightKg`, `ReportedSymptoms`, `SymptomDurationHours`, `SymptomSeverity`, `AdditionalNotes`

**Response:** `UrgencyLevel`, `UrgencyReasoning`, `DoctorNote`, `RedFlags`, `Confidence`, `RagChunksUsed`, `ModelUsed`

**RAG retrieval:** Reuse `query/hyde.py`, `query/retriever.py`. HyDE query e.g. *"pediatric patient age X months presenting with [symptoms]"*. **No `book_name` filter** — search full ingested corpus. If `< 3` chunks, fallback `CLINIC_VISIT` + disclaimer.

**Safety (`validate_triage_response`):**
- Neonate (`age_months < 3`) → never `HOME_CARE`
- Seizure / convulsion / breathing difficulty in symptoms → `EMERGENCY`
- Non-empty `red_flags` + `HOME_CARE` → `CLINIC_VISIT`
- `confidence == LOW` → append disclaimer to reasoning
- `sanitize_input`: max 20 symptoms, 100 chars each, strip injection patterns

**Logging:** Age bucket + symptom count only — no PII, no symptom text.

Register in `api/main.py`. Auth: same pattern as `/api/v1/query`.

---

## Phase 3 — Spring Boot (`backend-hospital`)

### API

| Method | Path | Roles |
|--------|------|-------|
| `POST` | `/api/v1/triage-results/analyze` | PATIENT |
| `GET` | `/api/v1/triage-results/appointment/{appointmentExternalId}` | PATIENT (own), DOCTOR, ADMIN |
| `POST` | `/api/v1/triage-results/save` | PATIENT — link triage to appointment after booking |
| `GET` | `/api/v1/triage-results` | PATIENT — paginated history |
| `POST` | `/api/triage/analyze` | PATIENT — legacy alias |

**Analyze request adds:** `ChildDisplayName`, optional `AppointmentExternalId`

**Service logic:**
1. Validate PATIENT actor
2. Java-side mirror of critical safety overrides
3. `PdfRagTriageAdapter.analyze()` — 30s timeout; fallback `CLINIC_VISIT` on error
4. Persist `TriageResultJpaEntity` including `child_display_name`
5. Localized envelope `Message` via `LocalizedApiMessages`

**Appointment link:** Optional `TriageResultExternalId` on appointment create → `linkToAppointment()` + prepend `[Pre-consultation triage]\n{doctor_note}` to `additional_notes`.

**Latest triage helper:**
```java
Optional<TriageResultResponse> findLatestForAppointment(UUID appointmentExternalId);
Optional<TriageResultResponse> findLatestForPatient(String patientUserId, Duration within);
```
`within` = 24h for soft-block freshness check.

**Config:**
```properties
app.ai.rag.triage-path=${APP_AI_RAG_TRIAGE_PATH:/api/v1/triage/analyze}
app.ai.rag.triage-timeout-seconds=${APP_AI_RAG_TRIAGE_TIMEOUT_SECONDS:30}
app.triage.freshness-hours=${APP_TRIAGE_FRESHNESS_HOURS:24}
```

---

## Phase 4 — Vue web (`frontend-hospital`)

### Components
- `DynTriageWizard.vue` — 4 steps: profile (incl. child name) → symptoms → loading → result
- `DynTriageResultBadge.vue` — doctor dashboard; shows urgency badge, `child_display_name`, expandable `DoctorNote`, red-flag chips, "Triaged X min ago"

### State (`useAppStore` key `TriageSession`)
`externalId`, `urgencyLevel`, `urgencyReasoning`, `doctorNote`, `redFlags`, `childDisplayName`, `childAgeMonths`, `appointmentExternalId`

### Entry points
1. **Pre-booking:** Patient home / nav → triage page → "Book appointment now" opens appointment popup with `additionalNotes` pre-filled from `doctorNote`
2. **Pre-video-call (soft block):** Before join-call, `GET` latest triage for appointment. If none within 24h → modal:
   - Primary: "Check symptoms first" → triage wizard with `appointmentId`
   - Secondary: "Continue without triage" → proceed to video call

### HTTP
- `src/services/http/triageApi.ts`
- Paths in `apiPaths.ts` + `packages/hospital-api-client`

---

## Phase 5 — React Native (`mobile-hospital`)

- `src/features/triage/TriageScreen.tsx` + `app/(app)/triage.tsx`
- Entry: `HomeQuickActions` — "Check symptoms before booking"
- Entry: `appointments/[id].tsx` — same soft-block modal before `openAppointmentVideoCall`
- React Query key: `['triage', appointmentId]` — always refetch after new analyze
- Emergency CTA: `Linking.openURL('tel:108')`
- Analyze failure: non-blocking toast + "Continue without triage"

---

## Phase 6 — Safety & compliance

- `.cursor/rules/triage-safety.mdc` — neonate, seizure, red-flag invariants
- Attach `healthcare-compliance.mdc` when implementing audit/consent
- Disclaimer on every result screen (client i18n); server owns reasoning text
- Do not expose triage symptom text in AI chat or public logs

---

## Phase 7 — Tests

**FastAPI (`tests/test_triage.py`):** neonate fever, seizure → emergency, mild URI, empty symptoms 422, injection sanitize, timeout fallback, no book filter mock

**Spring:** adapter mock, link-to-appointment, latest-within-24h, soft-block freshness

**Cypress (`triage_flow.cy.ts`):** wizard flow, amber result, book navigation, notes prefill, soft-block skip on video call

---

## Implementation order

1. `V23__triage_results.sql`
2. FastAPI triage route + safety
3. Spring service + adapter + appointment link
4. `hospital-api-client` paths
5. Vue wizard + badge + soft-block modal
6. Mobile screen + soft-block
7. Tests + `triage-safety.mdc`

**Estimate:** ~14–16 hours

---

## Environment

```bash
# pdf-rag-pipeline — existing OPENAI + DATABASE vars
# backend-hospital
APP_AI_RAG_BASE_URL=http://localhost:8090
APP_AI_RAG_TRIAGE_PATH=/api/v1/triage/analyze
APP_AI_RAG_TRIAGE_TIMEOUT_SECONDS=30
APP_TRIAGE_FRESHNESS_HOURS=24
```
