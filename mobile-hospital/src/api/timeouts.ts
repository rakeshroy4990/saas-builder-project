/** Default for JSON API calls (axios + fetch). Tuned for Cloud Run cold starts without hanging the UI. */
export const DEFAULT_API_TIMEOUT_MS = 15_000;

/** Token refresh during cold start may run alongside the brand splash. */
export const SESSION_RESTORE_TIMEOUT_MS = 30_000;

/** Large multipart uploads and AI streams that legitimately run longer. */
export const UPLOAD_API_TIMEOUT_MS = 180_000;

/** Batched telemetry flush (non-blocking background). */
export const TELEMETRY_BATCH_TIMEOUT_MS = 30_000;
