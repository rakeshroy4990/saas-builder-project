# backend-uimetadata-lib

Reusable Spring library for UI metadata APIs used by all backend services.

## What it provides

- API DTOs in `com.flexshell.uimetadata.api`
- Reusable facade contract: `UiMetadataFacade`
- Reusable REST controller: `com.flexshell.uimetadata.controller.UiMetadataController`

## How each backend reuses it

1. Depend on `com.flexshell:backend-uimetadata-lib:0.0.1-SNAPSHOT`
2. Implement `UiMetadataFacade` in a service bean
3. Keep backend-specific persistence logic local to that backend

## Extending for future endpoints

- Add new request/response DTOs under `com.flexshell.uimetadata.api`
- Add a new facade interface (or extend facade by versioning)
- Add a controller in `com.flexshell.uimetadata.controller` that depends only on facade contracts

This keeps endpoint contracts reusable while backend-specific data access remains isolated.

