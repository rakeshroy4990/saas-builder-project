/** Default for JSON API calls (axios + fetch). */
export const DEFAULT_API_TIMEOUT_MS = 15_000;

/** Login / Google exchange — Cloud Run cold starts can exceed 15s on first request. */
export const AUTH_API_TIMEOUT_MS = 30_000;

/** Token refresh during cold start may run alongside the brand splash. */
export const SESSION_RESTORE_TIMEOUT_MS = 30_000;

/** Large multipart uploads and AI streams that legitimately run longer. */
export const UPLOAD_API_TIMEOUT_MS = 180_000;

/** Growth history RAG summary (HyDE + embeddings + LLM). */
export const GROWTH_SUMMARY_TIMEOUT_MS = 120_000;

/** Doctor prescription validate-upload NDJSON (vision + safety checks). */
export const PRESCRIPTION_VALIDATE_STREAM_TIMEOUT_MS = 300_000;

/** Batched telemetry flush (non-blocking background). */
export const TELEMETRY_BATCH_TIMEOUT_MS = 30_000;
