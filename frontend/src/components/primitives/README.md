# Primitive Layer (Dumb/Pure Components)

Primitive components are display-focused and reusable.

## Rule of Thumb

- Accept resolved config/props.
- Render markup.
- Emit user events.

## Must Not

- Access stores directly.
- Call services/APIs.
- Instantiate action engines.
- Know route or domain/package details.

## Current Components

- `DynButton`
- `DynText`
- `DynInput`
- `DynDropdown`
- `DynList`
- `DynImage`
- `DynCheckbox`
- `DynRadioGroup`

## Interaction Contract

For interactive components, emit an `action` event payload and let renderer layer decide execution.
