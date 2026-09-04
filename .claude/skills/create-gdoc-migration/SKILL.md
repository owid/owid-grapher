---
name: create-gdoc-migration
description: Walk an engineer through writing and testing a gdoc migration — a structural change to an ArchieML component or frontmatter key applied to the source Google Docs and to posts_gdocs.content. Use when renaming, removing or rewriting a component property, changing a frontmatter key or value, or retiring old ArchieML syntax across many docs.
metadata:
    internal: true
---

# Create a gdoc migration

This skill is a **guided walkthrough, not an automation**. The goal is that
the engineer understands every step of the migration they are shipping, so:

- Go **one step per message**. Explain what the step does and why in a few
  sentences, then either do your part (writing code) or hand the user the
  exact command to run. End every step by checking in: "Does that make
  sense? Ready for step N?" and wait.
- **The user runs the CLI commands**, not you. Suggest the `! <command>`
  prefix so the output lands in the session, then read the output together
  and explain what it means before moving on.
- You write the code (migration file, wrapper, tests) — show it and explain
  the choices; the user reviews.
- Never run `apply`, `create-test-doc`, or anything else that writes, and
  never run `apply` against anything but the test doc from step 7.
- Never point the CLI at a staging or production database; it reads the DB
  the `.env` points to.

The production run (`plan` → `apply` → `verify` on the prod server) is not
part of this skill. It is done by the CMS maintainers; step 9 hands off to
them. `docs/gdoc-migrations.md` covers the engine's safety model and known
edge cases — point the user there when a flag or edge case comes up.

## Step 0 — what are we changing?

Ask for the change as a before/after ArchieML snippet, e.g.

```
{.chart}            {.chart}
caption: Foo   →    subtitle: Foo
{}                  {}
```

and whether it should cover all docs (default — drafts included, since the
goal is retiring old syntax) or published docs only.

Then explain the two-sided model in your own words: every gdoc migration
changes the same thing in two places. The **DB side** rewrites
`posts_gdocs.content` at deploy time through a normal `db/migration` file,
so the stored content flips in lockstep with the code that renders it. The
**gdoc side** edits the source Google Docs afterwards through the
`yarn gdocMigration` CLI, with surgical per-line `batchUpdate` requests that
leave everything else in the doc untouched. Between the two, a parser alias
keeps un-migrated docs working.

Check the prerequisites before continuing:

- dev stack up (`pgrep -f adminSiteServer`) with a recent DB snapshot
- `.env` has `GDOCS_CLIENT_EMAIL`/`GDOCS_PRIVATE_KEY` and
  `GDOCS_MIGRATION_TEST_FOLDER` (or `GDOCS_BACKPORTING_TARGET_FOLDER`)

## Step 1 — classify the migration

Explain the three kinds and which one this is; the kind decides how much
work the rest of the steps are.

| Kind                            | Example                                     | Needs                                                                                                                                                   |
| ------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Value-only** (component)      | rewrite `url` values, drop a redundant prop | migration file + wrapper. No type changes, no alias, no cleanup PR.                                                                                     |
| **Frontmatter** (declarative)   | rename `hide-subscribe-banner`, map `type`  | migration file + wrapper. Schema-changing if a key is renamed/removed (step 3). Denormalized keys (`type`, `slug`, `authors`) also update real columns. |
| **Schema-changing** (component) | rename `caption` → `subtitle` on `{.chart}` | everything above **plus** interface + parser-alias changes (step 3), and a cleanup PR later.                                                            |

Agree on the kind and on a name: `YYYY-MM-<slug>` (the file name and the
migration's `name` must match).

## Step 2 — write the migration file

Explain what you are about to write, then write
`db/gdocMigrations/migrations/YYYY-MM-<slug>.ts` from the closest template
and walk the user through each field:

- `_example-chart-caption-to-subtitle.ts` — component rename via helpers
- `2026-07-prominent-link-gdoc-urls.ts` — hand-written async transform pair
- `_example-frontmatter-rename.ts` — frontmatter ops

Things to explain as you go:

- **`discover`** is SQL that lists candidate docs. It only needs to be a
  superset: the engine re-checks every doc against the live fetch. Query
  `posts_gdocs_components` (`config` = enriched block JSON,
  `config->>'$.type'` = block type) for components, `posts_gdocs.content`
  for frontmatter. Read `db/docs/posts_gdocs_components.yml` first. Beware:
  parse-time aliases hide legacy raw syntax from the DB (`byline:` is
  stored as `authors`), so such syntax can't be discovered by SQL; and
  `posts_gdocs_components` only indexes `body`, so blocks inside `faqs`
  need a `posts_gdocs.content` query.
- **`transform`** sees the raw ArchieML block as loose JSON
  (`{ type, value }`) and returns the new block, the same block for no-op,
  or `null` to delete it. It must be **idempotent** — running it on its own
  output must change nothing — because that is how the engine verifies a
  migrated doc. Values can be link-styled (`url: <a href="…">…</a>`), so
  normalize with `extractUrl` before matching. The engine only patches
  scalar single-line values; multi-line (`:end`) values, chips and structural
  changes get flagged rather than patched.
- **`dbTransform`** is the same change expressed against the enriched JSON
  in `posts_gdocs.content`: properties sit directly on the block (no
  `value`), text is span arrays, and names may already differ from the raw
  ones (check `EnrichedBlock*` in
  `packages/@ourworldindata/types/src/gdocTypes/ArchieMlComponents.ts`).
  Prefer the helper pairs in `db/gdocMigrations/helpers.ts`
  (`renameProperty`/`renameEnrichedProperty`, …) so the two sides can't
  drift. If the DB change is reversible (a rename, a lossless map), add
  `dbDownTransform` / `downOps` too.
- Transforms are deliberately **loosely typed** (`RawBlockJson`, not the
  `RawBlock*` interfaces): migrations are frozen but the interfaces evolve.

Ask the user to review the file before moving on.

## Step 3 — schema-changing only: interface changes

Skip for value-only migrations. Otherwise explain the model: raw interfaces
are transitional (both spellings are legitimately on the wire while docs are
migrated), enriched interfaces are the canonical internal form and change
atomically — which is why the DB side must flip at the same deploy. Then
make these changes together:

1. Raw interface: add the new property, keep the old one optional and
   `@deprecated`.
2. Enriched interface: rename atomically; let the compiler drive consumer
   updates (renderer, markdown converter, baker).
3. Parser (`rawToEnriched.ts`, or `archieToEnriched.ts` for frontmatter):
   `new ?? old` — this alias is what keeps un-migrated docs working.
4. Serializer (`enrichedToRaw.ts`): emit only the new form.
5. Note the follow-up cleanup PR (remove the deprecated property + alias)
   for the PR description.

## Step 4 — the deploy-time wrapper

Explain: this is what makes the DB side run at deploy. Use the
`create-migration` skill to create the `db/migration` file, then reduce it
to:

```ts
import {
    applyGdocMigrationToDb,
    revertGdocMigrationInDb,
} from "../gdocMigrations/dbApplier.js"
import migration from "../gdocMigrations/migrations/YYYY-MM-<slug>.js"

export class GdocMigration<Name><timestamp> implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await applyGdocMigrationToDb(queryRunner, migration)
    }
    public async down(queryRunner: QueryRunner): Promise<void> {
        await revertGdocMigrationInDb(queryRunner, migration)
    }
}
```

If the migration has no `dbDownTransform`/`downOps`, leave `down()` empty
with a comment. Skip the wrapper only when there is no `dbTransform` at all.

## Step 5 — unit tests

Ask the user if they think their migration is complicated enough to warrant unit tests.
Explain what the tests protect against (a transform that isn't idempotent, a
`dbTransform` that drifts from `transform`), then write them, using as templates:

- `devTools/gdocMigrations/planVerify.test.ts` — build a doc with
  `buildDoc`/`para` from `testUtils.ts`, run `planDocumentPatch`, apply the
  requests with `simulateRequests`, assert the resulting ArchieML.
- `db/gdocMigrations/dbApplier.test.ts` — run `planGdocMigrationDb` against
  a fake query runner, assert the transformed content.

Cover the main case, a no-op block, a link-styled value if the transform
reads a URL, and applying twice. Then hand over:

```
! yarn test run --reporter dot <test files>
```

## Step 6 — dry-run the DB side against real content

Explain: this runs `dbTransform` (or the frontmatter ops) over the local
`posts_gdocs` table and prints what _would_ change, writing nothing. It is
the first time the migration meets real data.

```
! yarn gdocMigration db-plan --migration <name>
```

Read the output together:

- **Groups** are docs with the same diff shape. There should be one or two
  groups that are exactly the intended change; an unexpected group means
  the transform touches more than intended.
- **Details** show real before/after values for a few docs (`--limit <n>`
  for more).
- **Cross-check**: docs that change in the DB but are _not_ returned by
  `discover` are a bug in `discover` — the gdoc run would miss them.
  Discovered docs that don't change are fine when `discover` is a
  deliberate superset.

If reversible: `! yarn gdocMigration db-plan --migration <name> --down`.

## Step 7 — create a test doc

Explain: rather than hand-writing a fixture, the CLI fetches a spread of the
discovered docs, copies one real `{.blockType}` block per distinct shape
(property set, link-styled/empty/multi-line values, nesting) and writes them
into a fresh Google Doc in the test folder. That doc is the only thing the
gdoc side will be run against before the prod run. Blocks the Docs API can't
re-create faithfully (chips, bullets, tables, images) are skipped and
counted. Frontmatter test docs hold one line per key.

First a dry run, so the user sees what would go in:

```
! yarn gdocMigration create-test-doc --migration <name> --dry-run
```

Then ask which Google account to share the doc with, and hand over:

```
! yarn gdocMigration create-test-doc --migration <name> --share <email>
```

`--id <docId>` samples from specific docs instead; `--sample-docs`/
`--max-samples` widen the search. Ask the user to open the doc and confirm
it looks like real content.

## Step 8 — plan, apply, verify on the test doc

Explain each command before the user runs it, and confirm the `--id` is the
test doc's every time.

**plan** fetches the doc, computes the edits and prints them; nothing is
written:

```
! yarn gdocMigration plan --migration <name> --id <testDocId>
```

Expect exactly the intended edits per sample and **no flags**. Explain any
flag before continuing (`PatchFlagReason` in
`devTools/gdocMigrations/types.ts`; `docs/gdoc-migrations.md` for the
safety model). Note that `plan` also writes an entry to the migration's
journal in `devTools/gdocMigrations/runs/`.

**apply** re-plans against a fresh fetch, snapshots the doc JSON to disk,
sends the `batchUpdate` guarded by the doc's revision id, then re-fetches
and checks two things: every untouched line is byte-identical, and
re-planning the doc is a no-op:

```
! yarn gdocMigration apply --migration <name> --id <testDocId>
```

Expect `1 verified`. Ask the user to open the doc and eyeball the result —
formatting and links on edited lines should have survived.

**verify** is the standalone re-check used after the prod run; here it just
confirms the doc is clean:

```
! yarn gdocMigration verify --migration <name> --id <testDocId>
```

Finally, confirm the **two sides agree**: what `db-plan` did to a stored
block in step 6 should be the same set of renames/removals/rewrites that
`apply` just made in the test doc. A mismatch means `transform` and
`dbTransform` drifted.

Optionally, a full read-only plan gives the real grouped report and the
real flagged docs (never follow it with `apply` — that is the prod run):

```
! yarn gdocMigration plan --migration <name>
```

## Step 9 — checks, PR, handoff

Hand over the checks:

```
! yarn typecheck && yarn testLintChanged && yarn testFormatChanged
```

Commit per `docs/agent-guidelines/commit-messages.md`. The PR description
follows the repo convention: a concise human part with the change in one
sentence, the kind, the doc count from `db-plan`, and any flags the full
plan surfaced (this repo is public — no real doc content). In the
`<details>` block, the grouped `db-plan` summary and this checklist for the
prod runner:

```
After deploy (runs the DB migration and re-bakes):
1. yarn regenerateGdocMarkdown && yarn reconstructPostsGdocsComponents
2. yarn gdocMigration plan   --migration <name>     # review the grouped report
3. yarn gdocMigration apply  --migration <name>
4. yarn gdocMigration verify --migration <name>
5. Confirm zero old syntax: <the SQL from discover, or a stricter one>
6. Chase flagged docs by hand (status: yarn gdocMigration status --migration <name>)
7. Schema-changing only: open the cleanup PR removing the deprecated property and alias.
```

Remind the user to delete the test doc, or leave it for the prod runner.

## Pitfalls seen so far

- `discover` matching on `posts_gdocs_links` — it stores normalized targets;
  use `posts_gdocs_components.config` for literal URLs.
- A transform that "fixes up" values on every run (trimming, re-encoding) is
  not idempotent and gets flagged; normalize only when you actually change
  the value.
- Frontmatter keys are matched case-insensitively; docs contain `Title:`.
- `refs`, `faqs`, `details` frontmatter cannot be round-tripped;
  `defineGdocMigration` refuses ops on them.
- Blocks nested inside `{.sticky-right}`, `{.side-by-side}`, etc. are
  matched at any depth; the test doc sampler records nesting in the shape.
