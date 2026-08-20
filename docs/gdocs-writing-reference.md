# The gdocs writing reference

The writing reference documents the ArchieML building blocks of our
Google-Docs-authored content: every component an author can use in a gdoc,
and every gdoc type they can create. It lives in the admin at
`/admin/gdocs-reference`.

## The three layers

1. **Sidecars — the authored source.** Every member of
   `OwidEnrichedGdocBlock` has a Markdown sidecar next to its type definition
   in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/`
   (e.g. `Image.md` beside `Image.ts`). Each documented gdoc type has a
   template sidecar in `.../gdocTypes/templates/` (e.g. `Article.md`), and
   each content interface a field-descriptions file there (e.g.
   `OwidGdocPostContent.md`). Sidecars carry the prose: what a component is
   for, when (not) to use it, and fenced ` ```archie ` examples.

2. **The generator — derives the registries.**
   `yarn generateGdocsReferences` (in `devTools/gdocs/`) walks the type
   definitions with the TypeScript compiler, joins them with the sidecars,
   validates every example by parsing it through the real gdoc pipeline, and
   writes two committed registry files:
    - `docs/components.registry.generated.json`
    - `docs/templates.registry.generated.json`

    Completeness is structural: a new union member or documented gdoc type
    without a sidecar fails the build, as does an example that doesn't parse
    or a front-matter field without a description
    (`devTools/gdocs/sidecars.test.ts` asserts the pairing in the unit suite).

3. **The admin page — presents them.** The admin serves the registries at
   `/admin/api/gdocs-reference/{components,templates}.json` and enriches them
   at request time with live data from the database: how often each component
   is used per document type, real published instances of each component, and
   section outlines of exemplar documents.

## Editing the reference

Edit the sidecar (or the type's JSDoc), then run:

```
yarn generateGdocsReferences
```

and commit the regenerated registry JSONs together with your edit. The
`gdocs-references` CI job re-runs the generator on every PR and fails when
the committed registries are stale or a sidecar is invalid — it never edits
your branch.

### Adding a new component or front-matter field

For a **new component**: create `archieMLComponents/<Name>.md` next to the
type file (with a `@see ./<Name>.md` line in the type's JSDoc) and add the
component id to `COMPONENT_CATEGORY_BY_ID` in
`devTools/gdocs/generate-gdocs-references.ts` — a missing sidecar or category
fails `devTools/gdocs/sidecars.test.ts` and the generator. Sidecar
conventions: `## When to use` / `## When NOT to use` prose (whose
`{.other-id}` mentions become the structured `related` links) and at least
one fenced ` ```archie ` example, validated by parsing — prefer the verbatim
ArchieML of a real published instance once one exists.

For a **new front-matter field** on a content interface: classify it in the
matching `OWID_GDOC_*_CONTENT_KEY_KINDS` const in `types/src/gdocTypes/Gdoc.ts`
(`authored` or `computed` — the `satisfies` clause breaks the build until you
do) and describe it in `templates/<InterfaceName>.md`.

In both cases, finish with `yarn generateGdocsReferences` and commit the
regenerated registries.

## Why the registries are committed

The registries are derived files, committed on purpose (like
`defaultGrapherConfig.ts` or `regions.data.ts`): generation needs the
TypeScript compiler and the package sources, which the admin server doesn't
carry — serving them is a static import. They're marked `linguist-generated`
so GitHub collapses them in PR diffs.
