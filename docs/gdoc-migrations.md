# Gdoc migrations

**Status: implemented (component + frontmatter modes)** — engine core (source
map, scope scanner, block extraction, property patcher), Google API plumbing
(throttled client, suggestion detection), journal, and the
`plan`/`apply`/`verify`/`status` CLI (`yarn gdocMigration`) live under
`devTools/gdocMigrations/`; migration definitions, transform helpers, and the
deploy-time DB applier live under `db/gdocMigrations/` (so `db/migration`
wrappers can import them without a project-reference cycle). Not yet built:
the `resolveOwidUrlToGdocUrl` helper for the prominent-link use case.

A CLI tool for running structural migrations on our ArchieML content, applied
simultaneously to the source Google Docs and to the parsed content stored in
`posts_gdocs.content`. The canonical example: rename the `caption` property of
the `{.chart}` component to `subtitle` across every gdoc that uses it.

## Motivation

We regularly want to evolve our ArchieML component vocabulary but have no way
to update existing documents. Today a component rename means either:

- a DB migration that rewrites `posts_gdocs.content` (e.g.
  `1685107433682-UpdateGdocRecircComponent.ts`), leaving the source gdocs
  stale so the parser must support the old syntax forever, or
- hand-editing every affected doc (as was done for the pull-quote change in
  `1747953356597-UpdateGdocPullquotes.ts` — viable for 2 docs, not for 200).

Concrete migrations we've wanted but deferred:

1. **Rewrite internal links to gdoc URLs.** Replace
   `https://ourworldindata.org/some-slug` targets in `{.prominent-link}`
   blocks (and similar) with the equivalent
   `https://docs.google.com/document/d/<id>/edit` URL so the content graph
   resolves metadata automatically — and drop the now-redundant explicit
   `title:`/`filename:` properties. As of July 2026 this affects **322 blocks
   across 123 docs** (237 of those blocks carry an explicit `title`).
2. Property renames and removals as components evolve.
3. Frontmatter changes, e.g. migrating a `type:` value or retiring a
   deprecated flag.

## Why not parse → transform → rewrite the whole doc?

We have a tested, exhaustive round-trip at the _block_ level
(enriched ↔ raw ↔ ArchieML text — see `db/gdocTests.test.ts`), but
whole-document reconstruction is lossy and destructive:

- `gdocToArchie` silently drops native gdoc content at ingestion: inline
  images (authors paste chart screenshots as visual references), footnotes,
  untagged tables, page breaks.
- The document serializer (`owidArticleToArchieMLStringGenerator` in
  `archieToGdoc.ts`) never emits `refs`, `faqs`, `details`,
  `deprecation-notice`, or the `atom-*` fields — all user-authored. `{ref}`
  markers are rewritten to `<a class="ref">` anchors during parsing and never
  converted back.
- The existing write path (`createGdocAndInsertOwidGdocPostContent`) deletes
  the entire document body and re-inserts it, which destroys all comments,
  pending suggestions, and version-history anchoring.
- Even surviving content is not byte-identical: whitespace moves across link
  boundaries, frontmatter keys are lowercased, `:skip`/`:ignore` content
  vanishes.

So the engine never rewrites a document. It makes **surgical, line-scoped
edits** and leaves every other character untouched. Content that a full
rewrite would destroy survives by construction.

## Architecture

```
db/gdocMigrations/           # importable from db/migration wrappers (no ref cycle)
  types.ts                   # RawBlockJson, EnrichedBlockJson, migration definition types
  helpers.ts                 # renameProperty & friends (raw + enriched variants)
  dbApplier.ts               # applyGdocMigrationToDb: dbTransform over posts_gdocs.content
  migrations/
    2026-07-XX-chart-caption-to-subtitle.ts

devTools/gdocMigrations/
  cli.ts                     # plan | apply | verify | status (yarn gdocMigration)
  types.ts                   # engine types: SourceLine, PatchFlag, PatchResult
  engine/
    sourceMap.ts             # gdocToArchie variant that records line → char-range mapping
    scopeScanner.ts          # lightweight ArchieML scope tracker over source-mapped lines
    extractBlock.ts          # matched block lines → RawBlockJson (the transform's input)
    propertyPatcher.ts       # property-level diff → batchUpdate requests
    planDoc.ts               # per-doc plan: match, transform, diff, safety checks
    verifyDoc.ts             # post-apply expected-lines comparison
    suggestions.ts           # pending-suggestion detection
    throttledDocsClient.ts   # concurrency cap + retry/backoff around the Docs API
    journal.ts               # per-run, per-doc state for resumability
    runner.ts                # plan/apply/verify orchestration
  runs/                      # journals (gitignored)
```

### The engine, per document

1. **Fetch** the live doc via `documents.get` (read-write auth from
   `OwidGoogleAuth.getGoogleReadWriteAuth()`), recording its `revisionId`.
   Fetch with `SUGGESTIONS_INLINE` so pending suggestions are detectable.
2. **Parse with a source map.** A variant of `gdocToArchie` emits, alongside
   each ArchieML line, the start/end character indexes of the paragraph it
   came from. Lines the converter fabricates (`[.list]` wrappers, `{.table}`
   scaffolding, `{.horizontal-rule}`) have no source range and are marked
   _unpatchable_.
3. **Match.** The scope scanner tracks ArchieML nesting (`{.block}`…`{}`,
   `[.array]`…`[]`, `[+body]`) over the lines and yields the targets the
   migration asked for — component blocks of a given type, or top-level
   frontmatter keys.
4. **Transform and diff.** Each matched block's lines are parsed into a
   `RawBlockJson` and handed to the migration's transform. The engine then
   computes a **property-level diff** between the block and its transformed
   version: renames (a removed key and an added key holding an identical
   value), value changes, deletions, and insertions.
5. **Patch.** Each property edit becomes the smallest possible set of
   requests: a key rename replaces only the key token's character range
   (leaving the possibly-styled value, chips, and comments on the line
   untouched); a value change replaces just the after-the-colon range with
   styled `insertText`/`updateTextStyle` requests (reusing the cheerio →
   `TextFragment` machinery in `archieToGdoc.ts`); a deleted property removes
   exactly its line(s). Edits are ordered bottom-up so indexes never shift
   under each other, and sent in one `batchUpdate` with
   `writeControl.requiredRevisionId` set to the revision the edit was
   computed from.
6. **Verify.** Re-fetch the doc and assert the core invariant:

    ```
    parse(migratedDoc) == transform(parse(originalDoc))    (modulo undefined)
    ```

    plus `GdocBase.validate()` on the result (link checking etc.).

7. **Journal.** Record the outcome (applied / skipped / flagged) with the
   before/after revision IDs.

Note this loop is the _gdoc_ side only. The stored-content side runs once, at
deploy time — see "Interface changes and the stored-content flip" below.

### Two matcher modes, one engine

**Component mode** targets body blocks. The transform is a single function:

```ts
type RawBlockJson = { type: string; value: Record<string, unknown> }

transform: (block: RawBlockJson) => RawBlockJson | null
// null ⇒ delete the block
```

Transforms are **deliberately loosely typed**, like our existing DB content
migrations. Migration files are frozen once merged, but interfaces keep
evolving — a transform typed against `RawBlockChart` would break the repo's
typecheck as soon as the cleanup PR deletes the deprecated property it
references.

A component migration carries **two expressions of the same change**:
`transform` (raw side, drives the gdoc edits) and `dbTransform` (enriched
side, drives the deploy-time rewrite of `posts_gdocs.content`). They cannot
be a single function: by the time the migration runs, the enriched
interfaces have already been renamed, so the typed enriched → raw conversion
(`enrichedBlockToRawBlock`) would read the _new_ field name from old-shape
stored JSON and silently drop the old property before the transform ever saw
it. The DB applier therefore walks the content JSON loosely and recursively
(the historical content-migration pattern). For the declarative helpers the
pairing is mechanical — `renameProperty`/`renameEnrichedProperty` — and any
divergence between a hand-written pair is caught by the verification
invariant, since a republished doc parses through the alias into what
`dbTransform` should have produced.

**Frontmatter mode** targets top-level `key: value` lines outside any scope.
Here a single function can't serve both sides: the doc holds raw strings
(`hide-citation: true`, keys with arbitrary casing) while the DB holds parsed
values (booleans, `authors` arrays, `extractUrl`-unwrapped links). So
frontmatter migrations are **declarative** — `renameKey`, `removeKey`,
`setValue`, `mapValue` — where each op knows how to express itself on both
representations (`setValue` takes an optional explicit `dbValue`; `mapValue`
runs the same function against both representations, which is exact for
plain-string keys like `type` and needs defensive writing elsewhere). An
escape hatch of paired raw/db transform functions can be added if a real
migration ever needs it.

Frontmatter caveats:

- Some frontmatter is denormalized into real columns (`content.type` →
  `posts_gdocs.type`, `authors`, slug). The DB applier re-derives those
  columns the way `upsertGdoc` does.
- Structured top-level sections the serializer can't round-trip (`refs`,
  `faqs`, `details`) are out of scope: the engine refuses to touch them and
  flags the doc instead.
- Key matching is case-insensitive (parsing lowercases keys, so a doc may
  legitimately contain `Type:`).

### Migration file anatomy

```ts
// devTools/gdocMigrations/migrations/2026-07-XX-chart-caption-to-subtitle.ts
export default defineGdocMigration({
    name: "chart-caption-to-subtitle",
    mode: "component",
    blockType: "chart",
    // SQL against posts_gdocs_components; the engine re-verifies every match
    // against the freshly fetched doc, so this only needs to be a superset.
    discover: `
        SELECT DISTINCT gdocId FROM posts_gdocs_components
        WHERE config->>'$.type' = 'chart'
          AND JSON_CONTAINS_PATH(config, 'one', '$.caption')
    `,
    transform: renameProperty("caption", "subtitle"),
    dbTransform: renameEnrichedProperty("caption", "subtitle"),
})
```

`renameProperty` and friends are sugar over the raw transform function;
migrations can always drop down to a hand-written function.

### Interface changes and the stored-content flip

Migrations come in two flavors with very different footprints:

- **Value-only migrations** change property _values_ but not the component's
  schema (e.g. the prominent-link URL rewrite). No interface changes, no
  parser alias, no cleanup PR.
- **Schema-changing migrations** rename or remove properties (or whole
  components). These need coordinated type changes, and the raw and enriched
  interfaces are treated differently. **We do not version interfaces** — a
  short, bounded transition with one deprecated optional property is enough,
  and ArchieML carries no version marker that would make real versioning
  meaningful.

**Raw interfaces are transitional.** Raw types describe the wire format, and
during a migration the wire legitimately contains both spellings (un-migrated
docs, flagged docs, WIP drafts). So the old property stays, optional and
marked `@deprecated`, alongside the new one. The parser alias reads both
(`subtitle: value.subtitle ?? value.caption`); the serializer emits only the
new form. The cleanup PR removes the deprecated property and the fallback.

**Enriched interfaces are atomic.** Enriched is the canonical internal form;
it is renamed outright in the same commit, and the typechecker drives every
consumer update (renderer, markdown converter, baker). No `??` fallbacks ever
appear in rendering code.

Atomic enriched types have a hard consequence: **the stored content in
`posts_gdocs.content` must flip at the same deploy** — deploys trigger a
bake, so stored old-form content meeting new-form renderers is a guaranteed
user-visible regression, not a tolerable window. Therefore the DB-side apply
runs at deploy time, as a thin `db/migration` wrapper around the shared
transform:

```ts
// db/migration/1751xxxxxxxxx-GdocMigrationChartCaptionToSubtitle.ts
export class GdocMigrationChartCaptionToSubtitle1751xxxxxxxxx implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await applyGdocMigrationToDb(queryRunner, chartCaptionToSubtitle)
    }
    public async down(): Promise<void> {} // content migrations are not reversible
}
```

The transform still lives in exactly one file; the wrapper just gives it a
deploy-ordered execution slot. Staging and dev environments stay correct
either way (migration replay, or prod DB dumps). On fresh test databases the
wrapper no-ops (`posts_gdocs` is empty), which is also what makes the
live-code import tolerable despite the usual "migrations are frozen"
convention — that convention is additionally protected by keeping transforms
loosely typed (see above).

The example checklist for a `caption → subtitle` rename, commit 1:

1. `RawBlockChart.value`: add `subtitle?: string`, keep `caption?: string`
   with `@deprecated`.
2. `EnrichedBlockChart`: rename `caption` → `subtitle` (atomic).
3. `parseChart` in `rawToEnriched.ts`: `subtitle: value.subtitle ?? value.caption`
   — this _is_ the alias.
4. `enrichedToRaw.ts`: emit `subtitle` only.
5. Consumer renames (site renderer, markdown), compiler-led.
6. The migration file + the thin `db/migration` wrapper.

Cleanup commit (after the CLI run and zero-old-syntax verification): remove
the deprecated raw property and the parse fallback.

### Discovery

Discovery is pure SQL — no JS content scanning:

- **Components**: `posts_gdocs_components` stores every block flattened, with
  its full JSON `config` and a JSONPath (`path`, e.g. `$.body[3]`) back into
  the content tree.
- **Frontmatter**: query `posts_gdocs.content` top-level fields directly,
  e.g. `content->>'$.type' = 'article'`.
- `posts_gdocs_links` is useful for link-centric discovery but stores
  _normalized_ targets (host stripped for grapher/gdoc links), so
  `posts_gdocs_components` is the faithful source when matching literal URLs.

By default a migration targets **all** rows in `posts_gdocs` (drafts
included — the goal is retiring old syntax, and drafts get republished
eventually). `--published-only` narrows when appropriate.

Known blind spot: discovery reflects the last-synced content. A doc whose
_unsaved_ draft added a matching block won't be found. The parser alias (see
lifecycle) makes this safe; a "scan all source docs" fallback mode can close
the gap later if it matters.

## Migration lifecycle

The transitional-state problem: docs with old syntax and code that only
understands new syntax must never meet. The lifecycle guarantees this with a
**parser alias** that maps old syntax to new at parse time
(e.g. `caption` → `subtitle` in `parseChart`). Because the alias operates at
parse time, an author republishing an un-migrated doc still produces
new-form content in the DB — the system self-heals and the DB can never
regress.

1. Write the migration; test it against a personal gdoc with `--id <docId>`
   (works for docs that aren't in the DB at all).
2. PR: migration file, the thin `db/migration` wrapper, and — for
   schema-changing migrations — the interface changes and parser alias, plus
   any rendering changes. Deploy: this transforms stored content and re-bakes
   it, so the live site flips atomically with the code.
3. After the deploy, regenerate derived state from the transformed content:
   `yarn regenerateGdocMarkdown` and `yarn reconstructPostsGdocsComponents`
   (the `markdown` and `posts_gdocs_components` tables don't rebuild
   themselves, and the zero-old-syntax verification queries read them).
4. On the prod server: `plan` → review the grouped diff report → `apply`
   (the gdoc side) → `verify`.
5. Confirm zero old syntax remains (one query against
   `posts_gdocs_components` / `posts_gdocs.content`); chase flagged docs
   manually.
6. Follow-up PR removes the alias and the deprecated raw property.

The split is deliberate: the **stored-content transform runs at deploy**
(it must be atomic with the enriched interface change — see "Interface
changes and the stored-content flip"), while the **gdoc edits run via the
CLI** afterwards. In between, docs hold old syntax while the DB holds new
form; the parser alias covers that gap, along with skipped/flagged docs and
WIP drafts republished later.

### CLI

```
yarn gdocMigration plan   --migration chart-caption-to-subtitle [--id <docId>] [--published-only]
yarn gdocMigration apply  --migration chart-caption-to-subtitle [--id <docId>]
yarn gdocMigration verify --migration chart-caption-to-subtitle
yarn gdocMigration status --migration chart-caption-to-subtitle
```

- **plan**: fetches every candidate doc, computes edits, prints the grouped
  report and writes the journal. No writes to Google or the DB.
- **apply**: re-plans each doc against a fresh fetch and applies the edits
  (see race handling), snapshotting the pre-edit doc JSON first. Each doc is
  verified immediately after: the expected-lines comparison plus a re-plan
  that must come back a no-op. Resumable — verified docs are skipped.
- **verify**: re-fetches docs and asserts the migration is a no-op (no edits,
  no flags) everywhere. Running `GdocBase.validate()` over migrated docs is a
  possible future addition.
- **status**: prints the journal.

### The plan report

A migration touching ~200 docs must be reviewable in minutes, not hours.
The report groups docs by **diff shape** — most diffs from a single migration
are structurally identical, so the report shows each distinct shape once
(e.g. "line `caption:` → `subtitle:`", 180 docs, doc list attached) and
reserves individual attention for outliers: flagged docs, unusual diffs,
synthetic-line hits.

## Safety

- **Concurrent-edit race**: every `batchUpdate` carries
  `writeControl.requiredRevisionId` from the same `documents.get` the edits
  were computed against. On failure (author edited in between): re-fetch,
  re-plan that doc, retry once, then flag.
- **Pending suggestions**: if suggestion markers
  (`suggestedInsertionIds`/`suggestedDeletionIds`) overlap a _target block's_
  line ranges, skip the gdoc edit and flag the doc. Block-scoped, not
  doc-scoped — authors use suggesting mode routinely, and a doc-scoped skip
  would flag far too much. (`batchUpdate` cannot apply edits _as_
  suggestions, so there is no gentler option.)
- **Synthetic lines**: if a transform's line diff touches an unpatchable
  line, the engine fails closed — flag, don't patch.
- **Journal**: per-run JSON on disk mapping docId →
  planned/applied/verified/skipped/flagged plus before/after revision IDs.
  Crash-resumable; re-runs are idempotent (transform finds no match → no-op).
- **Snapshots & recovery**: the fetched doc JSON is written to disk before
  any edit. There is no automated rollback for gdoc edits — recovery is
  manual, via the snapshot and Google's native version history. This is a
  deliberate limitation.
- **The WIP guardrail**: the tool must never write _fetched_ doc content into
  `posts_gdocs.content`. DB-side writes are pure transforms of stored
  content; gdoc-side writes are pure transforms of doc content; the two never
  cross. (Otherwise migrating a published doc whose source is mid-rewrite for
  a data update would publish the WIP.) Enforced by an assertion, not just
  convention.
- **Derived state**: the deploy-time DB transform rewrites `content` only —
  `markdown` and `posts_gdocs_components` are regenerated right after deploy
  by the existing `yarn regenerateGdocMarkdown` and
  `yarn reconstructPostsGdocsComponents` scripts (lifecycle step 3), so
  derived tables don't drift. Republishing is neither required nor
  triggered — the site picks up transformed DB content at the deploy bake,
  exactly as historical content migrations did.
- **Rate limiting**: net-new (nothing in the codebase throttles Google API
  calls today). Concurrency cap of ~5 with exponential backoff on 429s; ~200
  docs × 3 calls each (get, batchUpdate, verification get) completes well
  inside the Docs API per-minute write quota.

## Known edge cases

- **Smart chips**: a `url:` value pasted as a `richLink` chip has no text to
  patch; the patcher special-cases it as chip deletion + styled text
  insertion.
- **Link-styled values**: a URL typed as link-styled text arrives in raw
  ArchieML as `<a href="...">…</a>` markup. Value-rewriting helpers normalize
  via the existing `extractUrl` logic so migrations match both forms.
- **Orphaned comments**: a comment anchored to an edited line loses its
  anchor (the range is deleted and re-inserted). Acceptable for property
  renames; the plan report notes which docs have comments near edits.
- **Multi-line values** (`:end` blocks, backported `html:` blocks) diff as
  multiple contiguous lines and patch normally.

## v1 scope boundaries

- Transforms operate **within** a matched block or on scalar frontmatter
  keys. Moving content between blocks, editing free paragraph text, and
  touching `refs`/`faqs`/`details` are out of scope.
- No gdoc-side rollback beyond snapshots + version history.
- No admin UI — this is a dev-piloted CLI, expected to run on the prod
  server a few times a year.

## Worked example: prominent-link URL rewrite

```ts
export default defineGdocMigration({
    name: "prominent-link-gdoc-urls",
    mode: "component",
    blockType: "prominent-link",
    discover: `
        SELECT DISTINCT gdocId FROM posts_gdocs_components
        WHERE config->>'$.type' = 'prominent-link'
          AND config->>'$.url' LIKE 'https://ourworldindata.org/%'
    `,
    transform: async (block, ctx) => {
        const gdocUrl = await ctx.resolveOwidUrlToGdocUrl(block.value.url)
        if (!gdocUrl) return block // no gdoc for this URL (e.g. grapher page) — leave it
        return {
            ...block,
            value: omit({ ...block.value, url: gdocUrl }, [
                "title",
                "filename",
            ]),
        }
    },
})
```

`resolveOwidUrlToGdocUrl` is a net-new helper assembled from existing pieces:
normalize the URL, follow `redirects` (and `chart_slug_redirects` /
`multi_dim_redirects` where relevant), then look up the final slug in
`posts_gdocs` (type-aware — slug is not unique across types). Returns null
for URLs that don't resolve to a gdoc, so the transform can leave them
untouched rather than guess.

This is a **value-only** migration: no interface changes, no parser alias, no
cleanup PR — just this file, the thin `db/migration` wrapper, and a CLI run.

## Worked example: frontmatter rename

Renaming the `hide-subscribe-banner` frontmatter key to
`hide-newsletter-banner`:

```ts
// devTools/gdocMigrations/migrations/2026-08-XX-hide-newsletter-banner.ts
export default defineGdocMigration({
    name: "hide-newsletter-banner",
    mode: "frontmatter",
    discover: `
        SELECT id FROM posts_gdocs
        WHERE JSON_CONTAINS_PATH(content, 'one', '$."hide-subscribe-banner"')
    `,
    ops: [renameKey("hide-subscribe-banner", "hide-newsletter-banner")],
})
```

Each declarative op knows both of its expressions: on the gdoc side,
`renameKey` becomes a patch to the single top-level `hide-subscribe-banner:`
line (matched case-insensitively, since parsing lowercases keys); on the DB
side, it renames the top-level field in `content`. This is a
**schema-changing** migration, so the accompanying commit follows the same
checklist as a component rename: transitional key on the raw/parsing side
(`archieToEnriched` reads the old key as an alias for the new one — the same
mechanism that maps `byline` → `authors` today), atomic rename on
`OwidGdocPostContent`, and a cleanup PR once verification passes.

A value-mapping op looks like:

```ts
ops: [
    mapValue("type", (value) =>
        value === "linear-topic-page" ? "topic-page" : value
    ),
]
```

Ops that touch denormalized frontmatter (`type`, `authors`, slug) also update
the corresponding `posts_gdocs` column, the way `upsertGdoc` derives it — a
`type` migration that only rewrote `content` would silently desync the column
everything filters on.

One discovery caveat specific to frontmatter: parse-time aliases hide old
syntax from the DB. Docs still written with `byline:` are invisible to a
`content` query because parsing already normalized the key to `authors` —
migrating that kind of legacy raw syntax requires the "scan all source docs"
fallback mode rather than SQL discovery.

## Implementation notes / pointers

- Read pipeline: `GdocBase.fetchAndEnrichGdoc` (`db/model/Gdoc/GdocBase.ts`).
- Write primitives: `documents.batchUpdate` usage and the cheerio →
  `TextFragment` styled-text writer in `db/model/Gdoc/archieToGdoc.ts`.
- Bulk-runner shape: `devTools/regenerateGdocMarkdown.ts` (pagination,
  `--id`, change detection, failure collection).
- Validation to reuse: `GdocBase.validate()`.
- Diff-report prior art: `adminSiteClient/GdocsDiff.tsx` (word-level diff of
  stringified content).
