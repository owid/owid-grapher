# The gdocs writing reference

The writing reference documents the ArchieML building blocks of our
Google-Docs-authored content: every component an author can use in a gdoc,
every gdoc type they can create, and guides to the mechanics that cut across
both (refs, headings, …). It lives in the admin at `/admin/gdocs-reference`.

This file is for developers and agents who change what that page shows.
Authors read the rendered page; nothing here documents ArchieML syntax itself,
which lives in the sidecars.

## How it fits together

1. **Sidecars — the authored source.** Markdown files next to the type
   definitions in `packages/@ourworldindata/types/src/gdocTypes/`:
   `archieMLComponents/Image.md` beside `Image.ts` for a component,
   `templates/Article.md` for a gdoc type,
   `templates/OwidGdocPostContent.md` for a content interface's field
   descriptions, and `guides/<id>.md` for a concept that is neither
   (refs, headings …). They carry the prose — what a component is for, when
   (not) to use it, and examples. See [Sidecar reference](#sidecar-reference).

2. **The generator — derives the registries.** `yarn generateGdocsReferences`
   (`devTools/gdocs/generate-gdocs-references.ts`) walks the type definitions
   with the TypeScript compiler, joins them with the sidecars, validates every
   example by parsing it through the real gdoc pipeline, and writes three
   committed registry files:
    - `docs/components.registry.generated.json`
    - `docs/templates.registry.generated.json`
    - `docs/guides.registry.generated.json`

    Completeness is structural: a new member of `OwidEnrichedGdocBlock`, or a
    documented gdoc type, without a sidecar fails the build — as does an
    example that doesn't parse, or a front-matter field without a description.
    The generator's file header lists everything it exits non-zero on.

3. **The admin page — presents them.** The admin serves the registries at
   `/admin/api/gdocs-reference/{components,templates,guides}.json` and enriches
   them at request time with live data from the database: how often each
   component is used per document type, real published instances of each
   component, and a template's exemplar documents. The first exemplar document
   is rendered whole, as the site renders it, in the same preview frame as
   component examples; a profile exemplar renders and links for the first
   entity in the profile's scope.

Facts stay derived (name, type, optionality, adoption); only judgement is
authored. If you find yourself typing a property's name or type into a
sidecar, you are in the wrong file.

## Editing the reference

Edit the sidecar (or the type's JSDoc), run `yarn generateGdocsReferences`, and
commit the regenerated `docs/*.registry.generated.json` files with your edit.
The `gdocs-references` CI job re-runs the generator on every PR and fails on
stale registries or an invalid sidecar; it never edits your branch.

### Adding a component

Create `archieMLComponents/<Name>.md` next to the type file (with a
`@see ./<Name>.md` line in the type's JSDoc) and add the component id to
`COMPONENT_CATEGORY_BY_ID` in `devTools/gdocs/generate-gdocs-references.ts` — a
missing sidecar or category fails `devTools/gdocs/sidecars.test.ts` and the
generator. The sidecar needs `## When to use` / `## When NOT to use` prose and
at least one fenced ` ```archie ` example; prefer the verbatim ArchieML of a
real published instance once one exists.

A `## Properties` section is required whenever the type declares props. It
documents the _effect_ of each property, as
``- `prop`: what setting it does, and what happens when it is omitted``
bullets (the same shape as the template field files). The generator lifts them
out of the prose into the properties table, and checks them against the props
derived from the type: a section that exists must describe every declared
property, and may not name one the type doesn't declare.

### Adding a front-matter field

Classify the new key in the matching `OWID_GDOC_*_CONTENT_KEY_KINDS` const in
`types/src/gdocTypes/Gdoc.ts` (`authored` or `computed` — the `satisfies`
clause breaks the build until you do) and describe it in
`templates/<InterfaceName>.md`.

### Adding a guide

Create `guides/<id>.md` — the file name is the guide id — with `title` and
`category` front matter (one of `GUIDE_CATEGORIES` in
`types/src/gdocTypes/GuideReference.ts`; today `Writing`, `Structure`,
`Charts & data`, `Publishing`). Write the intro, any free `## ` sections and an
optional `## Notes`, and add fenced examples anywhere. The decision and
`## Properties` headings are component/template vocabulary and fail in a guide.

## Sidecar reference

### Sections

A sidecar's `## ` sections are a declared vocabulary, listed in
`devTools/gdocs/sidecarSections.ts`:

| Section                           | What it becomes                                                   |
| --------------------------------- | ----------------------------------------------------------------- |
| (intro, before the first `## `)   | the lead prose; for components, where ` ```archie ` examples live |
| `## When to use`                  | the "Use it for" panel; its mentions become `related`             |
| `## When NOT to use`              | the "Reach for something else when" panel                         |
| `## Properties` (components only) | the effect column of the properties table                         |
| `## Notes`                        | authored notes under the derived material (heading dropped)       |
| any other `## ` heading           | free prose, rendered with the notes                               |

Free sections and `## Notes` are combined into one run of prose, and their
order depends on the sidecar kind: in a guide, free sections render in source
order and `## Notes` last; in component and template sidecars, the `## Notes`
content renders first, then the free sections.

The vocabulary is closed on purpose: a heading is parsed once, at generation
time, and the registries carry the split prose, so no consumer can disagree
with the generator about what a heading means. Anything ambiguous is therefore
a build error rather than a silent fallback — a near-miss heading
(`## When to use it`, `## Propertes`), a repeated or empty section, a `### `
subsection inside one (promote it), a sidecar with no intro. The errors name
the heading you meant.

Every component needs `## When to use`, unless its front matter opts out:

- `decision: none` — a block with no authorial choice (an internal primitive,
  a legacy block).
- `decision: todo` — guidance simply not written yet; the generator counts
  these out on every run.
- `auto-generated: <short phrase>` — the parser produces this block from
  Google Docs formatting rather than from an ArchieML tag, and the phrase
  describes the formatting that produces it, e.g.
  `auto-generated: a plain paragraph`. These sort last within their category,
  and the detail page shows a warning box instead of authoring guidance.

### Mentions

A backticked span whose whole content is `{.component-id}`, `{guide:guide-id}`
or `{template:template-id}` renders as a link and a "Related" entry. The
generator harvests every mention into `related` and fails the build on an id
that resolves to nothing, so every mention the page renders is a working link.
`devTools/gdocs/mentions.ts` carries the exact rule: a bare `{.id}` outside
backticks is not a mention, and one inside a fenced example is example code.

This is the only linking syntax. A plain single-backtick span equal to a known
component, template or guide id — `` `topic-page` `` instead of
`` `{template:topic-page}` `` — is a lint error, not a silent no-op: the
generator fails the build naming the explicit form to use.

The lint runs wherever a sidecar's prose is rendered: the intro, decision
sections, `## Notes`, other free sections, and template field descriptions. Two
places are exempt — `## Properties` bullets, which document a component's own
props and routinely repeat ids as plain code, and a field's own name and value,
which keep the existing `key:` / `type: value` convention.

### Examples

Examples are fenced ` ```archie ` (a body snippet, wrapped in a fragment and
parsed) or ` ```archie-document ` (a whole document with front matter, guides
only). Both are validated by the real pipeline, but guide examples are never
rendered: the admin shows them as code. The whole-document checks are listed in
`devTools/gdocs/exampleValidation.ts`. Fences are identified by section and
position, not by text — in a component sidecar they live in the intro, in a
guide they may sit in any section.

## Why the registries are committed

The registries are derived files, committed on purpose (like
`defaultGrapherConfig.ts` or `regions.data.ts`): generation needs the
TypeScript compiler and the package sources, which the admin server doesn't
carry, so the admin serves them with a static import instead. They're marked
`linguist-generated` so GitHub collapses them in PR diffs.
