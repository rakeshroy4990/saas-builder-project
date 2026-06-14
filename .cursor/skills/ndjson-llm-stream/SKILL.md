---
name: ndjson-llm-stream
description: >-
  Implement NDJSON streaming for LLM-backed Spring endpoints and Vue/mobile clients.
  Use when adding or fixing /stream routes, StreamingResponseBody, fetch ReadableStream
  parsers, or debugging stream_incomplete errors. Reference triage analyze (working gold standard).
---

# NDJSON LLM stream — implementation skill

Follow this checklist end-to-end. **Reference (working):** triage AI diagnosis  
`TriageResultV1Controller` → `TriageResultService.streamAnalyze` → `triageAnalyzeStream.ts`.

## Contract

| Event | Shape |
|-------|--------|
| `ready` | `{"type":"ready","data":{}}` |
| `status` | `{"type":"status","data":{"phase":"transcribing"}}` |
| `delta` | `{"type":"delta","text":"token chunk"}` — top-level `text`, not nested |
| `complete` | `{"type":"complete","data":{...PascalCase domain fields...}}` |
| `error` | `{"type":"error","data":{"message":"…","errorCode":"STABLE_CODE"}}` |

Envelope keys are always lowercase `type`/`data` (`NdjsonStreamWriter`).

---

## 1. Spring controller

```java
private static final MediaType NDJSON = MediaType.parseMediaType("application/x-ndjson");

@PostMapping(
    value = "/your-feature/stream",  // or same path + Accept ndjson like triage
    consumes = MediaType.MULTIPART_FORM_DATA_VALUE, // or APPLICATION_JSON_VALUE
    produces = {"application/x-ndjson", "application/ndjson"}
)
public ResponseEntity<StreamingResponseBody> yourFeatureStream(
    ...,
    HttpServletResponse httpResponse
) {
    httpResponse.setBufferSize(1024);
    httpResponse.setHeader("X-Accel-Buffering", "no");
    httpResponse.setHeader(HttpHeaders.CACHE_CONTROL, "no-store");
    StreamingResponseBody body = yourService.streamYourFeature(...);
    return ResponseEntity.ok()
        .contentType(NDJSON)
        .header(HttpHeaders.CACHE_CONTROL, "no-store")
        .body(body);
}
```

**Must use** `ResponseEntity<StreamingResponseBody>` (not `ResponseEntity<?>`) so Spring uses `StreamingResponseBodyReturnValueHandler`.

---

## 2. Spring service

```java
return outputStream -> {
    AtomicBoolean terminalEventSent = new AtomicBoolean(false);
    try {
        NdjsonStreamWriter.writeReady(outputStream, objectMapper);
        NdjsonStreamWriter.writeStatus(outputStream, objectMapper, "phase_name");
        // ... work ...
        NdjsonStreamWriter.writeLine(outputStream, objectMapper, "complete", completePayloadMap);
        terminalEventSent.set(true);
    } catch (IllegalArgumentException ex) {
        NdjsonStreamWriter.writeError(outputStream, objectMapper, ex.getMessage(), ex.getMessage());
        terminalEventSent.set(true);
    } catch (Exception ex) {
        if (!terminalEventSent.get()) {
            NdjsonStreamWriter.writeError(outputStream, objectMapper, "…", "FEATURE_FAILED");
            terminalEventSent.set(true);
        }
    }
};
```

- Build `complete.data` as explicit `LinkedHashMap` with **PascalCase** keys (`TriageResultService.writeCompleteRow` pattern). Do not rely on `convertValue` alone for nested DTOs.
- Flush after every line (`NdjsonStreamWriter` already flushes).
- Proxy pdf-rag: read each line, forward or rewrite `complete`, never buffer full LLM output before first byte.

---

## 3. DomainEventAutoEmitFilter (critical — stream_incomplete root cause)

**Every new NDJSON route must bypass `ContentCachingResponseWrapper`.**

File: `backend-hospital/.../DomainEventAutoEmitFilter.java`

`isNdjsonStreamRequest` must return true when:
- `Accept` contains `application/x-ndjson` or `application/ndjson`, AND
- path matches stream endpoint.

Current pattern (covers all `*/stream` paths):

```java
return path.contains("/triage-results/analyze")
    || path.endsWith("/hospital/ai/chat")
    || path.contains("/stream");
```

**If you add a stream and forget this filter, the client gets `*_stream_incomplete` — bytes are cached and never flushed line-by-line.**

---

## 4. Vue client (`*Stream.ts`)

Copy structure from `frontend-hospital/src/services/http/triageAnalyzeStream.ts`:

1. `fetch` with `Accept: application/x-ndjson` (not axios for body).
2. `credentials: 'include'` + `ensureAccessTokenFreshForFetch()`.
3. `AbortSignal.timeout(180_000)` merged with caller signal.
4. `ReadableStream` reader + line buffer (`\n` split).
5. `dispatchNdjsonLine` handles: `ready`, `status`, `delta`/`token`, `complete`, `error`.
6. `complete`: parse `data` payload; set `sawComplete`; throw if missing at EOF.
7. JSON envelope fallback when `content-type` is `application/json` without ndjson.
8. Absolute Spring URL via `getApiBaseUrl()` — never relative `/api/...` (hits Vite).

**Working reference files:**
- `triageAnalyzeStream.ts` — JSON body stream
- `patientPrescriptionSimilarityStream.ts` — multipart stream
- `doctorPrescriptionSafetyValidateUploadStream.ts` — multipart validate stream

---

## 5. Paths & packages

Add to all three:
- `frontend-hospital/src/services/http/apiPaths.ts` → `SERVER_PATHS`
- `packages/hospital-api-client/src/index.ts` → `SERVER_PATHS`
- e2e mocks if applicable

---

## 6. Verification checklist

- [ ] `DomainEventAutoEmitFilter.isNdjsonStreamRequest` includes new path
- [ ] Controller sets `X-Accel-Buffering: no`, small buffer, `no-store`
- [ ] Service emits `ready` immediately, then `status` phases, terminal `complete` or `error`
- [ ] Client uses fetch + NDJSON reader; `sawComplete` set on `complete` or `error`
- [ ] `spring.mvc.async.request-timeout` ≥ 300000 for long LLM work (`application.properties`)
- [ ] Restart backend after Java changes; test stream in browser Network tab — lines arrive incrementally

---

## 7. Debugging `*_stream_incomplete`

1. Check Network → response streams line-by-line (not one blob at end).
2. If one blob at end → **DomainEventAutoEmitFilter** not bypassing path.
3. If lines arrive but no `complete` → server exception before terminal event; check server logs.
4. If `complete` arrives but client fails parse → fix PascalCase keys in `complete.data` or client parser.
