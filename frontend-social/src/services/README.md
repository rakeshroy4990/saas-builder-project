# Services Layer

Services are the only place where API calls are allowed.

## Structure

- `http/apiClient.ts`: axios instance + interceptors.
- `domain/*/services.ts`: package-specific `ServiceDefinition[]`.

## Execution Model

1. Renderer dispatches action.
2. `ActionEngine` resolves service by `packageName::serviceId`.
3. Service executes API call and updates stores.
4. Action chain handles success/failure follow-up.

## Standards

- No API calls from Vue components.
- Store response in `useAppStore` using package/key buckets.
- Return normalized response with `responseCode`.
