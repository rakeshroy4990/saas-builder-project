# Package: `com.flexshell.uimetadata` (+ `uimetadata.api`)

## Role

Persist and load **declarative UI packages** to Mongo when enabled; implements persistence hooks used by **`UiMetadataService`** (`UiMetadataFacade` from shared API).

## Types

- `MongoDataConfiguration`, `UiMetadataEntity`, `UiMetadataRepository`, `UiMetadataPersistenceService`

## HTTP

Primary REST surface is from **`backend-uimetadata-lib`** (typo path **`/api/uiMetdata`** whitelisted in `SecurityConfig`). Hospital service delegates save/get when storage is available.

## Reference file

`src/main/resources/ui-metadata.json` is a **reference catalog** (documented in-file: not served by the API). Runtime UI metadata is loaded via **`/api/uiMetdata`** when Mongo persistence is available.

---

*Last updated: 2026-04-18*
