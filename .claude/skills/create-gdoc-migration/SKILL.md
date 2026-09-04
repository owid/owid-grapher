---
name: create-gdoc-migration
description: Write and test a gdoc migration — a structural change to an ArchieML component or frontmatter key applied to the source Google Docs and to posts_gdocs.content. Use when renaming, removing or rewriting a component property, changing a frontmatter key or value, or retiring old ArchieML syntax across many docs.
metadata:
    internal: true
---

# Create a gdoc migration

Produces a reviewed, tested migration PR. The production run (`plan` → `apply`
→ `verify` on the prod server) is **not** part of this skill: it is done by
the CMS maintainers, and the PR hands off to them with a checklist.

Read [docs/gdoc-migrations.md](../../../docs/gdoc-migrations.md) first — it
is the spec for the engine, the lifecycle and the safety model. This skill
only sequences the work.

## Prerequisites

- The dev stack is up (`pgrep -f adminSiteServer`), with a recent DB snapshot.
- `.env` has the Google service-account credentials (`GDOCS_CLIENT_EMAIL`,
  `GDOCS_PRIVATE_KEY`) and a Drive folder for test docs
  (`GDOCS_MIGRATION_TEST_FOLDER`, falling back to
  `GDOCS_BACKPORTING_TARGET_FOLDER`). The service account must be able to
  read the docs it samples from.
- Ask for the user's Google account email to share the test doc with.

## Hard rules

- **Never run `apply` without `--id` pointing at a test doc you created.** No
  `--id`, or an `--id` of a real doc, writes to real content. Confirm the id
  is the test doc's before every `apply`.
- **Never point the CLI at a staging or production database.** `db-plan`,
  `plan` and `create-test-doc` read the DB the `.env` points to.
- The DB side runs at deploy via the `db/migration` wrapper — never apply
  `dbTransform` by hand, and never write fetched doc content to the DB.
- This repo is public. Don't paste real doc content into the PR; the plan
  report's grouped summary is fine.

## Step 1 — classify the change

| Kind                            | Example                                     | Needs                                                                                                                                                  |
| ------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Value-only** (component)      | rewrite `url` values, drop a redundant prop | migration file + wrapper. No type changes, no alias, no cleanup PR.                                                                                    |
| **Frontmatter** (declarative)   | rename `hide-subscribe-banner`, map `type`  | migration file + wrapper. Schema-changing if a key is renamed/removed (see step 3). Denormalized keys (`type`, `slug`, `authors`) also update columns. |
| **Schema-changing** (component) | rename `caption` → `subtitle` on `{.chart}` | everything above **plus** the interface + parser-alias changes in step 3, and a cleanup PR later.                                                      |

Also decide the scope: all docs (default, drafts included — the goal is
retiring old syntax) or `--published-only`.

## Step 2 — write the migration file

Create `db/gdocMigrations/migrations/YYYY-MM-<slug>.ts`, with `name` equal
to the filename minus `.ts`. Start from the closest template:

- `_example-chart-caption-to-subtitle.ts` — component rename via helpers
- `2026-07-prominent-link-gdoc-urls.ts` — hand-written async transform pair
- `_example-frontmatter-rename.ts` — frontmatter ops

Rules for the transform (`transform`, raw ArchieML side):

- **Idempotent.** The engine verifies a migrated doc by asserting the
  transform is a no-op on it, and flags non-idempotent transforms at plan
  time. Return the block unchanged (same reference is fine) when there is
  nothing to do.
- **Loosely typed.** Use `RawBlockJson`, never the `RawBlock*` interfaces —
  migrations are frozen but the interfaces keep evolving.
- Values may be link-styled: `url: <a href="…">…</a>`. Normalize with
  `extractUrl` before matching, like the prominent-link migration does.
- Prefer the helpers in `db/gdocMigrations/helpers.ts` (`renameProperty`,
  `removeProperty`, `rewriteProperty`, `renameBlockType`,
  `composeTransforms`) — each has an enriched-side twin so the pair is
  mechanical.
- The engine only patches scalar, single-line property values. Multi-line
  (`:end`) values, chips and nested structure changes are flagged, not
  patched — don't design a transform that needs them.

Rules for `dbTransform` (enriched side, `posts_gdocs.content`):

- Enriched blocks hold properties **directly** (no `value` wrapper) and text
  properties are **span arrays**, not strings. Property names may already
  differ from raw ones — check `EnrichedBlock*` in
  `packages/@ourworldindata/types/src/gdocTypes/ArchieMlComponents.ts`.
- It must express the same change as `transform`; the two are checked
  against each other in step 6. Omit it only for migrations that never need
  to touch stored content.

Discovery SQL: query `posts_gdocs_components` (`config` holds the enriched
block JSON, `config->>'$.type'` the block type) for components, or
`posts_gdocs.content` for frontmatter. It only needs to be a **superset** —
the engine re-verifies every match against the fetched doc. Read
`db/docs/posts_gdocs_components.yml` and `db/docs/posts_gdocs.yml` before
writing it. Parse-time aliases hide legacy raw syntax from the DB (e.g.
`byline:` is stored as `authors`), so such syntax cannot be discovered by SQL.

## Step 3 — schema-changing migrations: interface changes

Follow the checklist in the spec's "Interface changes and the stored-content
flip" section, in the same PR:

1. Raw interface: add the new property, keep the old one optional and
   `@deprecated`.
2. Enriched interface: rename atomically (the compiler drives consumer
   updates in the renderer, markdown converter, baker).
3. Parser (`rawToEnriched.ts`, or `archieToEnriched.ts` for frontmatter):
   read both, `new ?? old` — this is the alias that keeps un-migrated docs
   working.
4. Serializer (`enrichedToRaw.ts`): emit only the new form.
5. Note the follow-up cleanup PR (remove the deprecated property + alias) in
   the PR description.

## Step 4 — the deploy-time wrapper

Use the `create-migration` skill to create a `db/migration` file, then make
it a thin wrapper:

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

If the DB side is reversible (a rename, a lossless value map), declare the
inverse on the migration — `dbDownTransform` for component migrations,
`downOps` for frontmatter — and check it with `db-plan --down`. If it is
not (a removal, a lossy rewrite), leave `down()` empty with a comment; the
gdoc side is never reverted automatically either way.

Skip the wrapper only when there is no `dbTransform`.

## Step 5 — unit tests

Add a `*.test.ts` next to the engine tests in `devTools/gdocMigrations/`
(or extend `gdocMigrations.test.ts`). Templates:

- `planVerify.test.ts` — build a doc with `buildDoc`/`para` from
  `testUtils.ts`, run `planDocumentPatch`, apply the requests with
  `simulateRequests`, and assert the resulting ArchieML.
- `db/gdocMigrations/dbApplier.test.ts` — run `planGdocMigrationDb` against
  a fake query runner and assert the transformed content.

Cover at least: the main case, a no-op block (unchanged), a link-styled
value if the transform reads a URL, and that applying twice changes nothing.
Run with `yarn test run --reporter dot <files>`.

## Step 6 — check against real content

Run these in order and read the output; fix the migration and repeat until
all are clean.

1. **DB dry run** (reads the local DB, writes nothing):

    ```
    yarn gdocMigration db-plan --migration <name>
    ```

    Check the grouped diff shapes are exactly the intended change and nothing
    else. The cross-check at the end compares the changed set with the
    discover query: docs that change but are _not discovered_ are a bug in
    `discover` (the gdoc run would miss them). Discovered docs that don't
    change are fine when `discover` is a deliberate superset.

2. **Test doc** (creates one Google Doc in the test folder, nothing else):

    ```
    yarn gdocMigration create-test-doc --migration <name> --dry-run
    yarn gdocMigration create-test-doc --migration <name> --share <email>
    ```

    It fetches a spread of discovered docs, copies one real block per
    distinct shape (property set, link-styled/empty/multi-line values,
    nesting) and writes them into a fresh doc. Look at the dry run first;
    add `--id <docId>` to sample from specific docs. Frontmatter test docs
    hold one line per key, so cover further value shapes with more docs.

3. **Gdoc side, on the test doc only:**

    ```
    yarn gdocMigration plan   --migration <name> --id <testDocId>
    yarn gdocMigration apply  --migration <name> --id <testDocId>
    yarn gdocMigration verify --migration <name> --id <testDocId>
    ```

    `plan` must show exactly the intended edits per sample and no flags.
    Understand every flag before moving on — `PatchFlagReason` in
    `devTools/gdocMigrations/types.ts` lists them. `apply` must end with
    every doc `verified`; open the doc and eyeball the result. `verify` must
    report the doc clean.

4. **The two sides agree.** For a component migration, confirm that what
   `db-plan` does to a stored block matches what `apply` did to the same
   block in the test doc (same properties renamed/removed/rewritten). A
   mismatch means `transform` and `dbTransform` drifted.

5. **Full read-only plan** (optional, fetches every discovered doc):

    ```
    yarn gdocMigration plan --migration <name>
    ```

    Gives the real grouped report and the real flagged docs. Never follow it
    with `apply` — that is the prod run.

Delete the test doc afterwards, or leave it in the folder if the prod
runner will want it.

## Step 7 — checks and the PR

Run `yarn typecheck`, `yarn testLintChanged`, `yarn testFormatChanged` and
the tests. Commit per `docs/agent-guidelines/commit-messages.md`.

The PR description follows the repo convention (concise human part, then a
`<details>` block). Include in the human part: the change in one sentence,
the kind (value-only / frontmatter / schema-changing), the doc count from
`db-plan`, and any flags the full plan surfaced. Put in the details block
the grouped `db-plan` summary and this handoff checklist for the prod
runner:

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
