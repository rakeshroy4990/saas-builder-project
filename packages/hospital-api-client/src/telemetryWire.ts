const TELEMETRY_WIRE_KEYS: Record<string, string> = {
  event_name: 'EventName',
  flow: 'Flow',
  status: 'Status',
  reason_code: 'ReasonCode',
  http_status: 'HttpStatus',
  trace_id: 'TraceId',
  login_session_id: 'LoginSessionId',
  user_id: 'UserId',
  session_summary_entry: 'SessionSummaryEntry',
  entry_id: 'EntryId',
  occurred_at: 'OccurredAt',
  kind: 'Kind',
  page_id: 'PageId',
  package_name: 'PackageName',
  component_id: 'ComponentId',
  popup_page_id: 'PopupPageId',
  route_path: 'RoutePath',
  api_path: 'ApiPath',
  http_method: 'HttpMethod',
  duration_ms: 'DurationMs',
  error_message: 'ErrorMessage',
  action_alias: 'ActionAlias',
  action_id: 'ActionId',
  user_email: 'UserEmail',
  attributes: 'Attributes',
  os: 'Os',
  device_id: 'DeviceId',
  browser_or_app: 'BrowserOrApp',
  events: 'Events',
};

/**
 * Maps internal telemetry payload keys to PascalCase API wire keys.
 */
export function toTelemetryWire(payload: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    const wireKey = TELEMETRY_WIRE_KEYS[key] ?? key;
    if (key === 'session_summary_entry' && value != null && typeof value === 'object' && !Array.isArray(value)) {
      out[wireKey] = toTelemetryWire(value as Record<string, unknown>);
      continue;
    }
    if (key === 'events' && Array.isArray(value)) {
      out[wireKey] = value.map((entry) =>
        entry != null && typeof entry === 'object' && !Array.isArray(entry)
          ? toTelemetryWire(entry as Record<string, unknown>)
          : entry
      );
      continue;
    }
    out[wireKey] = value;
  }
  return out;
}
