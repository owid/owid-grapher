# gdocTypes

The type definitions for our gdoc-authored content — and, alongside them, the
editor-facing prose that documents those types.

That second part is unusual for a types package, so, briefly: the `.md` files
in `archieMLComponents/`, `templates/` and `guides/` are not developer notes.
They are the authored source of the writing reference the admin serves at
`/admin/gdocs-reference`, and they sit here so a component's prose cannot
drift from the type alias it documents. The `*.registry.generated.json` files
are what the generator derives from them, committed and CI-checked; they live
beside the `*Reference.ts` types that describe their shape.

Nothing imports the `.md` files at runtime.

**Before editing a sidecar or adding a component, read
`docs/gdocs-writing-reference.md`** — it covers the pipeline, the sidecar
section vocabulary, mentions, examples, and what the generator fails on.
