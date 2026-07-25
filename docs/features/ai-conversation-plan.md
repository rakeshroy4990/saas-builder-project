# AI Conversation — Design & Implementation Plan

**Status:** Design locked · Web MVP implemented (pipeline + hero + review UI)  
**Last updated:** 2026-07-25  
**Scope v1:** Web only (mobile deferred)

Doctor-only feature to record patient consultations, transcribe multilingual speech (English, Hindi, Kannada, mixed), diarize Doctor/Patient, run a two-stage LLM pipeline, let the doctor review/edit, then save to the consultation record.

---

## Locked product decisions

| # | Decision | Choice |
|---|----------|--------|
| 1 | Platforms | **Web first**; mobile later |
| 2 | Entry point | Hero CTA adjacent to **AI Diagnosis**, doctor-only |
| 3 | UX shell | Consent modal → recording screen → processing → review tabs → Save |
| 4 | Persistence | Draft session during pipeline; **committed only on Save** |
| 5 | STT | OpenAI Whisper (`whisper-1` / configurable); preserve original multilingual text |
| 6 | Diarization v1 | LLM role labeling → `Doctor` / `Patient` (swappable); pluggable for true diarization later |
| 7 | LLM | Two-stage: Conversation Analyzer (extract only) → Clinical Summary (SOAP / Dx / follow-up) |
| 8 | Extensibility | Processor registry consumes Stage-1 structured JSON |

---

## Architecture fit (Agastya conventions)

| Concern | Convention |
|---------|------------|
| Public API | Spring `/api/audio/*` (action pipeline) + PascalCase wire JSON |
| Auth | `@PreAuthorize("hasRole('DOCTOR')")`; treating doctor only |
| Schema | Flyway `V36__consultation_audio.sql` |
| IDs | `external_id UUID`; appointment → `appointments.external_id`; patient = appointment `created_by` |
| Soft-delete | `deleted BOOLEAN` on clinical rows |
| i18n | Server `Message` via bundles `en`/`hi`/`kn`; UI chrome in client locales |
| Storage | Object key in DB; local or S3; encrypt-at-rest (S3 SSE / app wrap) |
| Clients | Browser never calls OpenAI directly |

---

## Pipeline (modular)

```text
Audio Recording (MediaRecorder)
        ↓
AudioUploadService
        ↓
SpeechRecognitionService          ← Whisper STT (mixed language)
        ↓
SpeakerDiarizationService         ← Doctor / Patient (+ swap)
        ↓
ConversationAnalyzerService       ← Stage 1 JSON (no diagnosis)
        ↓
ClinicalSummaryService            ↓ Stage 2 SOAP / Dx / patient summary
        ↓
Doctor Review (edit / copy)
        ↓
ConsultationStorageService.save   ← commit
```

Future processors (ICD-10, Rx generator, labs, billing, …) register against Stage-1 structured JSON without changing core services.

### Service interfaces

```text
AudioRecordingService          (client)
AudioUploadService
SpeechRecognitionService
SpeakerDiarizationService
ConversationAnalyzerService
ClinicalSummaryService
ConsultationStorageService
ConsultationProcessorRegistry  (extensibility)
```

---

## REST API (doctor-only)

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/audio/start` | Create draft session (appointment, consent, language hint) |
| `POST` | `/api/audio/upload` | Multipart audio → storage; optional `ChunkIndex` for periodic chunks (assembled on transcribe) |
| `POST` | `/api/audio/transcribe` | STT + diarization |
| `POST` | `/api/audio/analyze` | Stage 1 structured extraction |
| `POST` | `/api/audio/generate-summary` | Stage 2 clinical summary |
| `POST` | `/api/audio/save` | Commit after doctor review |
| `GET` | `/api/audio/{appointmentId}` | Load committed consultation for appointment |

Wire keys: PascalCase (`SessionId`, `Transcript`, `StructuredJson`, `Soap`, …).

---

## Data model

### `consultation_audio`

`id`, `external_id`, `appointment_external_id`, `doctor_user_id`, `patient_user_id`, `audio_storage_path`, `audio_url` (signed at read), `duration_seconds`, `language_detected`, `language_hint`, `consent_acknowledged`, `committed`, `deleted`, `created_at`, `updated_at`

### `consultation_transcript`

`id`, `external_id`, `consultation_audio_external_id`, `appointment_external_id`, `transcript_json` (diarized turns), `transcript_text`, `structured_json`, `summary_json`, `soap_json`, `committed`, `deleted`, `created_at`, `updated_at`

---

## UI (web)

1. **Hero:** `[ AI Diagnosis ] [ 🎙 AI Conversation ]` — navigates to AI Consultation Assistant (no popup)
2. **Page setup:** languages notice, appointment, conversation language (default **Mixed**), consent, **Start Recording**
3. **Recording:** timer, Pause / Stop (MediaRecorder, high-quality webm/opus); **~15s chunk uploads** + `pagehide`/`visibilitychange` keepalive so partial audio survives tab close
4. **Review tabs:** Transcript · Summary · SOAP · Diagnosis — edit / copy / delete transcript / Download / Save
5. **Security copy:** recording processed to generate summary; only treating doctor can access

---

## Security & compliance

- Consent required before Start
- No audio/transcript in logs
- Treating-doctor ACL on all reads/writes
- Audit log on save / access
- Configurable retention (`app.ai.conversation.retention-days`)
- AI disclaimer: assistive; not a substitute for clinical judgment

---

## Out of scope (v1)

- Mobile app
- Agora call mix recording
- True acoustic diarization (pyannote)
- ICD-10 / Rx / billing processors (hooks only)
