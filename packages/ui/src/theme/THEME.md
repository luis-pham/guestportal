# Theme foundation

## Light baseline

Default theme is `light`, applied via `:root` and `[data-theme='light']` in `tokens.css`.

## Surfaces

- Admin / Staff share the same foundation tokens.
- Guest may scope property brand via `[data-surface='guest'][data-property-brand]` and set:
  - `--gp-property-brand`
  - `--gp-property-brand-hover`

Do not invent plan/subscription colors. Do not hardcode feature palette names.

## Tailwind integration

Import CSS variables, then extend Tailwind:

```ts
import { guestPortalTailwindPreset } from '@guestportal/ui/tailwind-theme';

export default {
  presets: [guestPortalTailwindPreset],
  content: [/* app paths */],
};
```

All Tailwind color/spacing/radius/shadow/motion keys map to `--gp-*` CSS variables.

## Future themes

Set `data-theme` on `<html>` and redefine the same semantic `--gp-color-*` variables. Do not introduce page-specific token names.
