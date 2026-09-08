# The gdocs writing reference

The writing reference documents the ArchieML building blocks of our
Google-Docs-authored content: every component an author can use in a gdoc,
every gdoc type they can create, and guides to the mechanics that cut across
both (refs, headings, …). It lives in the admin at `/admin/gdocs-reference`.

## The three layers

1. **Sidecars — the authored source.** Every member of
   `OwidEnrichedGdocBlock` has a Markdown sidecar next to its type definition
   in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/`
   (e.g. `Image.md` beside `Image.ts`). Each documented gdoc type has a
   template sidecar in `.../gdocTypes/templates/` (e.g. `Article.md`), and
   each content interface a field-descriptions file there (e.g.
   `OwidGdocPostContent.md`). Cross-cutting concepts that are neither a block
   nor a document type (refs, headings …) get a guide sidecar in
   `.../gdocTypes/guides/<id>.md` — the file name is the guide id — with
   `title` and `category` front matter (`Writing`, `Structure`,
   `Charts & data`, `Publishing`). A guide has an intro, any free `## `
   sections and an optional `## Notes`; the decision and `## Properties`
   headings are component/template vocabulary and fail in a guide. Guide
   examples may sit in any section. Sidecars carry the prose: what a
   component is for, when (not) to use it, and fenced examples —
   ` ```archie ` body snippets, or ` ```archie-document ` whole documents in
   guides.

    **Mentions** cross-reference sidecars and link pages: a backticked code
    span whose whole content is `{.component-id}`, `{guide:guide-id}` or
    `{template:template-id}` becomes a link and a "Related" entry — bare
    `{.id}` outside backticks is not a mention, and one inside a fenced
    example is example code, not a reference. This is the only linking
    syntax: a plain single-backtick span equal to a known component,
    template or guide id (e.g. `` `topic-page` `` instead of
    `` `{template:topic-page}` ``) is a lint error, not a silent no-op — the
    generator fails the build naming the explicit form to use, everywhere a
    sidecar's prose is rendered (intro, decision sections, `## Notes` and
    other free sections, template field descriptions — not `## Properties`
    bullets, which document a component's own props and routinely repeat ids
    as plain code, and a field's own name and value, which stay in the
    existing `key:` / `type: value` convention rather than becoming a
    mention). The generator harvests every mention into `related` and fails
    the build on an id that resolves to nothing, so every mention the page
    renders is a working link.

    A sidecar's `## ` sections are a **declared vocabulary**, listed in
    `devTools/gdocs/sidecarSections.ts`:

    | Section                           | What it becomes                                                   |
    | --------------------------------- | ----------------------------------------------------------------- |
    | (intro, before the first `## `)   | the lead prose; for components, where ` ```archie ` examples live |
    | `## When to use`                  | the "Use it for" panel; its mentions become `related`             |
    | `## When NOT to use`              | the "Reach for something else when" panel                         |
    | `## Properties` (components only) | the effect column of the properties table                         |
    | `## Notes`                        | authored notes under the derived material (heading dropped)       |
    | any other `## ` heading           | free prose, rendered with the notes                               |

    Free sections and `## Notes` are combined into one run of prose, and
    their order depends on the sidecar kind: in a guide, free sections
    render in source order and `## Notes` last; in component and template
    sidecars, the `## Notes` content renders first, then the free sections.

    Headings are matched past casing and punctuation, but a **near miss**
    fails the build rather than drifting into the free prose: `## When to
 use it` or `## Propertes` are errors naming the heading you meant. So
    are a repeated section, an empty one, a `### ` subsection inside one
    (promote it), and a sidecar with no intro. Every component needs
    `## When to use` — a block with no authorial choice (an internal
    primitive, a legacy block) declares `decision: none` in its front
    matter instead, and one whose guidance is simply unwritten declares
    `decision: todo`, which the generator counts out on every run. Components
    that the parser produces from Google Docs formatting rather than from an
    ArchieML tag (`text`, `heading`, `list`, `simple-text`) declare
    `auto-generated: <short phrase>` in their front matter, describing
    what Docs formatting produces the block (e.g. `auto-generated: a plain
 paragraph`); they sort last within their category and the detail page
    shows a warning box instead of authoring guidance.

    **Examples** are fenced ` ```archie ` (a body snippet, wrapped in a
    fragment and parsed) or ` ```archie-document ` (a whole document with
    front matter, guides only). Both are validated by the real pipeline —
    the whole-document checks are listed in `devTools/gdocs/exampleValidation.ts`
    — but guide examples are never rendered; the admin shows them as code.
    Fences are identified by section and position, not by text.

2. **The generator — derives the registries.**
   `yarn generateGdocsReferences` (in `devTools/gdocs/generate-gdocs-references.ts`)
   walks the type definitions with the TypeScript compiler, joins them with the
   sidecars, validates every example by parsing it through the real gdoc pipeline,
   and writes three committed registry files:
    - `docs/components.registry.generated.json`
    - `docs/templates.registry.generated.json`
    - `docs/guides.registry.generated.json`

    Completeness is structural: a new union member or documented gdoc type
    without a sidecar fails the build, as does an example that doesn't parse
    or a front-matter field without a description
    (`devTools/gdocs/sidecars.test.ts` asserts the pairing in the unit suite).

3. **The admin page — presents them.** The admin serves the registries at
   `/admin/api/gdocs-reference/{components,templates,guides}.json` and enriches
   them at request time with live data from the database: how often each
   component is used per document type, real published instances of each
   component, and a template's exemplar documents — the first is rendered
   whole, as the site renders it, in the same preview frame as component
   examples. A profile exemplar renders and links for the first entity in
   the profile's scope.

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
conventions: the sections listed above — `## When to use` / `## When NOT to
use` prose (whose backticked mentions become the structured `related`
links) and at least one fenced ` ```archie ` example, validated by parsing —
prefer the verbatim ArchieML of a real published instance once one exists.

A `## Properties` section (required whenever the type declares props)
documents the _effect_ of each property,
as ``- `prop`: what setting it does, and what happens when it is omitted``
bullets (the same shape as the template field files). The generator lifts
them out of the prose into the properties table, and checks them against the
props derived from the type: a section that exists must describe every
declared property, and may not name one the type doesn't declare. Facts stay
derived (name, type, optionality, adoption); only the effect is authored.

For a **new front-matter field** on a content interface: classify it in the
matching `OWID_GDOC_*_CONTENT_KEY_KINDS` const in `types/src/gdocTypes/Gdoc.ts`
(`authored` or `computed` — the `satisfies` clause breaks the build until you
do) and describe it in `templates/<InterfaceName>.md`.

In both cases, finish with `yarn generateGdocsReferences` and commit the
regenerated registries.

### Adding a guide

For a **new guide**: create `guides/<id>.md` with `title` and `category` front
matter (one of `Writing`, `Structure`, `Charts & data`, `Publishing`), write
the intro, any free-form sections and an optional `## Notes`, add fenced
examples anywhere (` ```archie ` for body snippets, ` ```archie-document ` for
whole documents), and validate them by parsing. Finish with `yarn
generateGdocsReferences` and commit the regenerated registries.

## Why the registries are committed

The registries are derived files, committed on purpose (like
`defaultGrapherConfig.ts` or `regions.data.ts`): generation needs the
TypeScript compiler and the package sources, which the admin server doesn't
carry — serving them is a static import. They're marked `linguist-generated`
so GitHub collapses them in PR diffs.
