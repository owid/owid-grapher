---
name: add-gdoc-component
description: Add or extend an ArchieML/Gdoc component in the OWID content pipeline. Use when the user wants to introduce a new `{.component}` block, add props or variants to an existing gdoc component, or wire a component through parsing, rendering, attachments, generated docs, and tests.
metadata:
    internal: true
---

# Add Gdoc Component

Use this skill for codebase changes to the OWID ArchieML/Gdoc component system in `owid-grapher`.

This skill is intentionally orchestration-focused. The durable implementation details live in the repo docs and in nearby components.

## First read

Start with:

- [docs/agent-guidelines/gdocs-cms-pipeline.md](/Users/matthieu/Code/owid-grapher/docs/agent-guidelines/gdocs-cms-pipeline.md)

Then read the narrower docs only if needed:

- [docs/agent-guidelines/gdocs-attachments.md](/Users/matthieu/Code/owid-grapher/docs/agent-guidelines/gdocs-attachments.md)
- [docs/agent-guidelines/gdocs-class-hierarchy.md](/Users/matthieu/Code/owid-grapher/docs/agent-guidelines/gdocs-class-hierarchy.md)

## Workflow

1. Classify the request:
   - docs-only
   - existing component extension
   - new component with parser/render work
   - attachment-backed component
   - actually a new gdoc type, not a component
2. Inspect one or two nearby components that are structurally similar. Use those as the template for naming, typing, parsing, validation, and rendering.
3. Make the smallest change that satisfies the request. Prefer extending an existing block or improving examples over inventing a new component when that fits.
4. If the component surface changes, update the type/JSDoc under `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/`.
5. If parsing changes, update `db/model/Gdoc/rawToEnriched.ts` and `htmlToEnriched.ts` only where needed, with clear parse errors.
6. If rendering changes, update the relevant `site/gdocs/components/` code and any page-level wiring.
7. If the component needs extra data, wire attachments through the existing gdoc attachment flow rather than inventing a parallel path.
8. Regenerate the component registry after JSDoc changes:

```bash
yarn tsx --tsconfig tsconfig.tsx.json devTools/gdocs/generate-components-reference.ts
```

9. Add or update targeted tests.
10. For larger changes, finish with:

```bash
yarn fixFormatChanged > /dev/null 2>&1 && yarn typecheck
```

## Hard rules

- Do not invent ArchieML syntax that is not backed by the codebase.
- Do not manually edit generated component registry files; regenerate them.
- Do not treat the skill itself as the source of truth for exact file lists; inspect the current code and follow nearby patterns.
- Keep JSDoc examples realistic and parseable.
- Prefer targeted parse errors over silent fallback behavior when author input is malformed.
