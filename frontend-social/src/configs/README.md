# Config Layer (Dynamic UI Source)

`configs/` defines page structure declaratively for each package.

## Package Folders

- `ecommerce/`
- `hospital/`
- `social/`

Each exports `PageConfig[]` objects.

## How Dynamic UI Is Driven

- `container.layout` and `container.styles` define structure.
- `children[].type` selects primitive via `ComponentRegistry`.
- `mapping` fields bind UI to store data.
- `click`/`change` actions trigger service/navigation/popup flows.

## Best Practices

- Keep config serializable and framework-neutral.
- Reuse style templates where possible.
- Prefer action aliases for readability in large pages.
