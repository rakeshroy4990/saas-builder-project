/**
 * Session summary event kinds — append-only registry for the authenticated session (login → logout).
 *
 * How to add a new event:
 * 1. Add a constant here (snake_case string value).
 * 2. Emit it via {@link emitLoggedInSessionSummary} from the right hook (router, store, service, etc.).
 * 3. Prefer stable `page_id` / `component_id` / `popup_page_id` from UI config for traceability.
 * 4. `user_email` is filled automatically for logged-in rows (from persisted profile).
 * 5. For one-off or experimental payloads, use `attributes` instead of new top-level fields.
 */
export const SessionSummaryKind = {
  /** Issued after successful login (new {@code login_session_id} + trace id are minted in {@link finalizeHospitalLoginSession}). */
  AUTH_LOGIN: 'auth_login',
  /** User logout or session end (before local profile is cleared). */
  AUTH_LOGOUT: 'auth_logout',
  /** SPA route change (see {@link initSessionSummaryNavigation}). */
  NAVIGATE: 'navigate',
  /** Popup layer opened (see {@link usePopupStore}.open). */
  POPUP_OPEN: 'popup_open',
  /** User-triggered action from a component (button/container) with config ids. */
  BUTTON_CLICK: 'button_click',
  /** HTTP request completed (axios or {@code URLRegistry.request} / {@code requestResolvedUrl}); includes {@code duration_ms}. */
  API_CALL: 'api_call',
  /** HTTP request failed (network error or thrown fetch; axios errors use the same kind). */
  API_ERROR: 'api_error'
} as const;

export type SessionSummaryKindValue = (typeof SessionSummaryKind)[keyof typeof SessionSummaryKind];
