# bespoke/shared

Shared TypeScript modules used by both the bespoke projects and the site rendering code.

## Files

- **bespokeComponentTypes.ts** — Type definitions for the bespoke component interface (`BespokeComponentModule`, `BespokeComponentMountFn`, `BespokeComponentVariantsList`, etc.). Imported by projects via the `owid-bespoke-types` TS path alias.
- **bespokeComponentShadowDom.ts** — Utilities for mounting a bespoke component inside a Shadow DOM: creates the shadow root, loads CSS via a `<link>` element, dynamically imports the JS module, and calls `mount()`. Used by both the site's `BespokeComponent.tsx` and the dev server's demo page.

## How projects import from here

Each project maps `owid-bespoke-types` to this directory via a `paths` entry in its `tsconfig.json`:

```json
{
    "compilerOptions": {
        "paths": {
            "owid-bespoke-types": ["../../shared/bespokeComponentTypes.ts"]
        }
    }
}
```

Vite doesn't need to resolve these, since it only imports types (make sure to use `import type { ... } from "owid-bespoke-types"`).
