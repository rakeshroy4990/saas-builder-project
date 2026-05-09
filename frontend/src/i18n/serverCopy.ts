// Server-driven copy: honor Accept-Language (BCP-47) for API strings, or return stable codes for client i18n.
// Align message keys with locale JSON under src/locales when sharing bundles across repos.

export const SERVER_COPY_ACCEPT_LANGUAGE =
  'Honor Accept-Language for localized API strings, or return codes for client-side i18n.';
