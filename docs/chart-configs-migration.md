# Migration: `patch` + `full` → `config`

_How to get from today's schema to the one in
[`chart-configs-target-schema.md`](./chart-configs-target-schema.md). Read that
doc first — this one assumes its decisions. Row counts are from the dev DB
snapshot of 2026-08-10; the target DB is MySQL 8.4._

## Why this can be done in one release

The migration **relocates** data rather than destroying it. Every byte of
`chart_configs.patch` ends up in a patch row, so dropping the column afterwards
loses nothing and the down migration can put it back from the patch rows.

That is the whole safety argument, and it is worth being precise about, because a
superficially similar plan is genuinely irreversible: if patches were *derived*
away (`diff(config, parent)`) instead of copied, keys a human deliberately pinned
that happen to coincide with the parent would be lost forever. This plan never
derives anything — it copies, verifies, then drops.

Two consequences:

- No dual-write period is needed, and therefore no compatibility shims.
- The whole grapher change is a single PR with a working `down()`.

## Three PRs

```
PR 0  slug joins                    done — #6971
PR 1  the grapher migration         one release, reversible
PR 2  the ETL PR                    immediately after PR 1
```

### PR 0 — fix the by-slug R2 sync

**Done — [#6971](https://github.com/owid/owid-grapher/pull/6971)**, which went
wider than the one query below: four in total, and one of them was already wrong
today (the DoD usage query matched 2,295 rows of which 355 were mdim view configs,
reported as grapher usages against a null slug). `StaticViz` and the grapher URL
validation query in `db/db.ts` were correct but fragile, and are now phrased to
stay correct.

The blocking one was `devTools/syncGraphersToR2/syncGraphersToR2.ts:250`. Add
`JOIN charts c ON c.configId = cc.id`.

Without it, all 4,444 published charts match twice once patch rows exist — their
patch row carries both `slug` and `isPublished`, force-kept by
`diffGrapherConfigs` — and the results land in a `Map` keyed by
`config/by-slug/<slug>.json`, where last-write-wins picks nondeterministically. A
patch config served at `/grapher/<slug>` renders as a broken chart, with no error
anywhere: `idx_chart_configs_slug` is non-unique, so the DB will not catch it.

**This must land before any patch row exists.** Folding it into PR 1 would _almost_
work, since the fix goes live the same moment the rows do, except
`syncGraphersToR2` is a scheduled script that could fire mid-migration.

#### Audited and needs no change

`db/model/Post.ts:302` also reads `chart_configs.slug` without going through an
owner (`LEFT JOIN chart_configs cc ON pl.target = cc.slug`), but it is safe both
before and after, for three independent reasons. Recorded so nobody "fixes" it:

- A patch row's id matches no `charts.configId`, so `c.id` is NULL and
  `COALESCE(csr.chart_id, c.id)` is NULL, and the inner `chart_dimensions` join
  drops the row — except when a slug redirect exists, which supplies `csr.chart_id`.
- In that case `SELECT DISTINCT` collapses the duplicate anyway: every projected
  column comes from `p` (or `pv`, which depends only on `p.slug`), never from `cc`,
  `c` or `cd`.
- The case that would genuinely break it cannot arise. A chart patch row's slug is
  always identical to its resolved row's slug (`diffGrapherConfigs` force-keeps
  `slug`, and the resolved slug comes from the patch since slug is not inherited),
  so a patch row can never match a link target that no chart matches. mdim and
  narrative patches carry no slug at all.

The third instance of the same pattern, `etl/analytics/data.py:375`, does need the
join and rides in PR 2 — see the note at the end.

### PR 1 — the grapher migration

Five migration files, in this order.

| # | step | file | cost |
| - | ---- | ---- | ---- |
| 1 | `ADD COLUMN patchConfigId CHAR(36) NULL` + `UNIQUE` + FK `ON DELETE RESTRICT` on `charts`, `multi_dim_x_chart_configs`, `narrative_charts` | `AddPatchConfigIdPointers` | instant |
| 2 | Backfill 14,688 patch rows from `patch`; UUIDv7 per row; copy `createdAt`/`updatedAt` from the source row | `BackfillPatchConfigRows` | seconds |
| 3 | **Verify** the backfill while `patch` is still present. Abort if non-zero | ″ | seconds |
| 4 | Drop the view's `cc.patch` reference | `ReplaceChartConfigPatchAndFullWithConfig` | instant |
| 5 | Snapshot every `fullMd5` while `full` is intact | ″ | seconds |
| 6 | `DROP COLUMN slug, chartType, fullMd5` | ″ | in-place, **writes allowed** |
| 7 | `RENAME COLUMN full TO config` | ″ | instant |
| 8 | `DROP COLUMN patch` + re-add the three generated columns + `ADD INDEX idx_chart_configs_slug`, **one `ALTER`** | ″ | `COPY` rebuild, **writes blocked** |
| 9 | **Assert** no hash moved, then drop the snapshot | ″ | seconds |
| 10 | Rename `variables.grapherConfigId{ETL,Admin}` → `chartConfigId{ETL,Admin}` | `RenameChartConfigForeignKeys` | seconds |
| 11 | `MODIFY patchConfigId … NOT NULL` — **last**, once every writer populates it | `RequirePatchConfigIdPointers` | seconds |

**Split a migration only where the two halves reverse independently.** Steps 1 and
2–3 do: a column is undone by dropping it, backfilled rows by deleting them, and
each has a meaningful standalone `down()`. Steps 4–9 do **not**, which is why they
are one file: restoring the view needs both `patch` and `chartType` back, and those
return at different points, so across separate files the correct reversal order is
not expressible at all — TypeORM reverts newest-file-first and there is no ordering
that satisfies it. In one file the constraints are just the order the statements are
written in.

Retry-safety is *not* a reason to split. A migration that fails partway leaves its
completed statements applied but unrecorded either way, so a retry needs the same
hand-unpicking whether the work sits in one file or four; splitting only avoids
re-running the earlier files, which here are metadata-only.

Steps 6 and 7 exist only because MySQL refuses to rename a column that a generated
column depends on, and all three of ours are `STORED`.

Step 8 is deliberately one statement:

```sql
ALTER TABLE chart_configs
  DROP COLUMN patch,
  ADD COLUMN slug VARCHAR(255)
    GENERATED ALWAYS AS (json_unquote(json_extract(config, '$.slug'))) STORED,
  ADD COLUMN chartType VARCHAR(255)
    GENERATED ALWAYS AS (case when (json_unquote(json_extract(config,'$.chartTypes')) is null)
                              then 'LineChart'
                              else json_unquote(json_extract(config,'$.chartTypes[0]')) end) STORED,
  ADD COLUMN configMd5 CHAR(24) NOT NULL
    GENERATED ALWAYS AS (to_base64(unhex(md5(config)))) STORED,
  ADD INDEX idx_chart_configs_slug (slug);
```

Combining them means **one** write-blocking rebuild for the entire migration, and
it reclaims the ~90 MB freed by dropping `patch` in the same pass, so no separate
`OPTIMIZE TABLE` is needed. The expressions are copied verbatim from today's
definitions with `full` → `config`; keeping them identical is what guarantees the
hashes don't move.

Step 10 renames one pair: `variables.grapherConfigIdETL`/`grapherConfigIdAdmin` →
`chartConfigIdETL`/`chartConfigIdAdmin`. That makes `chartConfigId` the name of a
pointer into `chart_configs` on every owner table except `charts` itself, whose
`configId` predates the convention and is left alone.

`multi_dim_x_chart_configs`, `narrative_charts` and `explorer_views` keep
`chartConfigId` — renaming them to `configId` was considered and dropped. `config`
alone is under-specified next to the other things this schema calls a config
(`explorers.config`, `multi_dim_data_pages.config`), and `explorer_views` sits
directly beside one of them. Constraint names are also left alone: MySQL carries a
foreign key along with a renamed column, so renaming them would mean dropping and
re-adding each key and restating its ON DELETE/ON UPDATE rules by hand — a silent
way to change deletion semantics, for a name only migrations read.

Only **one** view needs recreating: `charts_x_parents`, and only to drop its dead
`cc.patch` reference rather than repointing it. Verified against
`information_schema.VIEWS` — of the six views in the DB, `chart_references_view` and
`datapages` reach `chart_configs` only through `charts.configId` and read only
`cc.slug`, so neither `full`, `patch` nor any renamed column appears in them.

Code in the same PR: read `config` and the patch rows; **no dual-writes**; a config
write becomes two rows in one transaction with the same `updatedAt`; deletes become
pair-aware; add the orphan sweep. One write site that is easy to overlook because it
does not name `chart_configs`: `apiRoutes/charts.ts:493` snapshots the patch into
`chart_revisions.config`, and must take it from the patch row.

#### Doc pass

`db/docs/` for the affected tables — `chart_configs.yml` (the columns, plus the
"always reach a config through its owner" invariant, which matters especially
because the table ships in the public metadata dump), `charts.yml`,
`multi_dim_x_chart_configs.yml`, `narrative_charts.yml`, `explorer_views.yml`,
`variables.yml` (note that the admin row stores the authored delta and the effective
indicator config is merged in code).

Plus one correction that is wrong **today**, independent of this refactor:

- **`db/docs/chart_revisions.yml`** claims "Each revision captures the _full_ chart
  configuration at a specific point in time." It stores the **patch** —
  `config: serializeChartConfig(patchConfig)` (`adminSiteServer/apiRoutes/charts.ts:493`).
  The value is only ever rendered as a diff between consecutive revisions in
  `adminSiteClient/EditorHistoryTab.tsx` and never restored programmatically, so
  patch-vs-patch diffs are coherent — it is the documentation that is wrong, not the
  behaviour.

#### PR 1 implementation plan

Nine migration files (`<timestamp>-<PascalCase>.ts`, via the `create-migration`
skill), mapping onto the steps above:

**`NOT NULL` on `patchConfigId` has to be the last migration of the whole PR**, and
therefore rides with commit 8, the last write-path commit. The backfill is not what
gates it: afterwards every existing row has a value, so the constraint would apply
cleanly. What gates it is every *subsequent* insert — `saveNewChart` doesn't list the
column (`adminSiteServer/apiRoutes/charts.ts:289`), so MySQL rejects it with `Field
'patchConfigId' doesn't have a default value`, which is what `make dbtest` hit when
this constraint was in the first commit. A default can't rescue it either: any
non-NULL default would have to be a real `chart_configs.id`, and the FK rejects
anything invented. `UNIQUE` and the FK do *not* have to wait: MySQL allows multiple NULLs in
a unique index and skips FK checks on NULL, and having them live during the backfill
means a duplicate id or dangling pointer fails at insert rather than at the verify.

Two consequences for the `down()` of the backfill: it has to clear the pointers
before deleting the rows they name (the FK is `ON DELETE RESTRICT`), which means
recording the ids in a temp table first; and reverting the whole PR only works in
that order.

**Put the hash check inside the migration, not in a rehearsal.** The snapshot is taken
while `full` is intact and asserted after the rebuild, so every environment — local,
staging, production — proves for itself that no hash moved, and a mismatch aborts
the deploy instead of being discovered later by a re-bake. Same for the step 3
backfill check and the `268,474` row count. Rehearse on a prod snapshot too, but
don't rely on remembering to.

**Historical migrations stay untouched.** They reference `patch`/`full` against the
schema as it was when they ran, and `make dbtest` replays them in order before ours,
so they keep working. Do not "fix" them.

Work order, so the tree compiles at each stage:

1. **Migrations** — write and run locally first; nothing else can be tested without
   the new schema.
2. **Types** — `dbTypes/ChartConfigs.ts` (`config`/`configMd5`; delete
   `parseChartConfigsRow` and `serializeChartsRow`), then the owner types:
   `Charts.ts`, `MultiDimXChartConfigs.ts`, `NarrativeCharts.ts` gain
   `patchConfigId`; `Variables.ts` renames to `chartConfigIdETL`/`chartConfigIdAdmin`.
   `ExplorerViews.ts` is unchanged. This lights up every *typed* call site — see
   "Two inventories, not one" below, because that is only half the work.
3. **Config-write core** — `db/model/ChartConfigs.ts` collapses its three update
   functions into one; `adminSiteServer/chartConfigHelpers.ts` writes the resolved
   and patch rows in one transaction with one `updatedAt` and one R2 object.
4. **New shared helper** — the effective indicator config
   (`mergeGrapherConfigs(etl, admin)`), replacing the hand-rolled merges at
   `db/model/ExplorerViews.ts:135` and `baker/siteRenderers.tsx:649`.
5. **Owner write paths** — `apiRoutes/charts.ts` (create, update, delete, the
   `JSON_SET($.id)` stamp on both rows, and the `chart_revisions` snapshot at
   `:493`), `apiRoutes/narrativeCharts.ts`, `adminSiteServer/multiDim.ts` (incl.
   `cleanUpOrphanedChartConfigs`), `db/model/ExplorerViews.ts`,
   `apiRoutes/datasets.ts` (`$.version` bump on both rows),
   `apiRoutes/bulkUpdates.ts`, `db/model/Variable.ts` (both
   `updateAll…ThatInheritFromIndicator` loops read the patch via the pointer and
   write the resolved row).
6. **Read sweep** — mechanical `cc.full` → `cc.config` across 34 files, and the six
   `cc.patch` reads become `patchConfigId` joins.
7. **Orphan sweep** — one `DELETE` behind a small `devTools` script; the ETL's
   `to_db.py` deletes from `multi_dim_x_chart_configs` directly, so orphans will keep
   appearing no matter how careful the call sites are.
8. **Docs** — the six `db/docs/` files plus the `chart_revisions.yml` correction.
9. **Tests** — update the `patch: "{}"` fixtures in `db/tests/basic.test.ts` and
   `adminSiteServer/tests/pageviews.test.ts`; add coverage for the three invariants
   that are new: a save writes both rows with equal `updatedAt`, a delete removes
   both, and an indicator change re-merges the resolved row from the patch row.

#### Two inventories, not one

`typecheck` after commit 4 finds the **typed** references — `row.full`,
`DbRawChartConfig["full"]`, object literals. It cannot find `full` or `patch` inside
a raw SQL template string, because that is just a string. Measured on this refactor:

| | files |
| --- | --- |
| caught by `typecheck` | 19 |
| containing `full`/`patch` in raw SQL | 28 |
| **SQL-only — invisible to the compiler** | **14** |
| union: the real sweep | 34 |

The SQL-only half is the dangerous half: those files compile clean and fail at
runtime, and `make dbtest` has been red since commit 2, so it will not flag them
either. `baker/sitemap.ts` is the plain example — one `cc.full` in a query, zero type
errors. The others are `apiRoutes/{charts,datasets,tags}.ts`, `baker/SiteBaker.tsx`,
`baker/algolia/utils/{charts,explorerViews}.ts`, `baker/archival/ArchivalBaker.ts`,
`db/db.ts`, and `db/model/{Dod,Post,NarrativeChart,Gdoc/GdocPost,archival/archivalDb}.ts`.
(`domainTypes/Archive.ts` matches too, but only in comments.)

So the sweep in commit 9 runs both passes, and these greps are its acceptance test:

```sh
# no typed or SQL reference to the old columns outside historical migrations
grep -rnE 'cc\.(full|patch)|cc_[a-z]+\.(full|patch)|chart_configs\.(full|patch)|\b(full|patch) ?->>' \
  --include='*.ts' --include='*.tsx' . | grep -v node_modules | grep -v '/db/migration/'
```

Historical migrations are excluded on purpose: they reference the columns as they
were when they ran, and `make dbtest` replays them in order. Do not "fix" them.

#### Commits

Eleven commits. The green/red column is what CI would say if it ran on that commit
alone — it only runs on the head, but it tells a reviewer which commits are meant to
stand on their own.

| # | message | contents | state |
| - | ------- | -------- | ----- |
| 1 | `🔨🤖 add patchConfigId pointers and backfill patch rows` | two migrations: nullable pointers + `UNIQUE` + FK, then the backfill with its equality assertion | **green** — purely additive, `patch`/`full` untouched |
| 2 | `🔨🤖 replace patch and full with a single config column` | one migration, `ReplaceChartConfigPatchAndFullWithConfig` — steps 4–9 | red at runtime — schema is final, code is stale |
| 3 | `🔨🤖 rename chart config pointers for consistency` | `RenameChartConfigForeignKeys` — including the two ETL-visible ones | red at runtime |
| 4 | `🔨🤖 point the type layer at the single config column` | `dbTypes/ChartConfigs.ts` + the five owner types; delete `parseChartConfigsRow` / `serializeChartsRow` | red — **deliberately**: `typecheck` now enumerates every real call site |
| 5 | `🔨🤖 write the resolved and patch rows together` | `db/model/ChartConfigs.ts` (three updaters collapse to one), `chartConfigHelpers.ts` (two rows, one transaction, one `updatedAt`, one R2 object) | red |
| 6 | `🔨🤖 merge the indicator config in one place` | the shared effective-indicator-config helper; `Variable.ts` drops `admin.full`; `ExplorerViews.ts:135` and `siteRenderers.tsx:649` lose their hand-rolled merges | red |
| 7 | `🔨🤖 update chart and narrative chart write paths` | `apiRoutes/charts.ts` (create, update, delete, the `JSON_SET($.id)` stamp on both rows, the `chart_revisions` snapshot at `:493`), `apiRoutes/narrativeCharts.ts` | red |
| 8 | `🔨🤖 update mdim, explorer and indicator write paths` | `multiDim.ts` incl. `cleanUpOrphanedChartConfigs`, `ExplorerViews.ts`, `Variable.ts` propagation loops, `datasets.ts` `$.version` bump, `bulkUpdates.ts`, `explorerJobProcessor.ts`, `refreshExplorerViews.ts` — **and** `RequirePatchConfigIdPointers` (`MODIFY … NOT NULL` ×3), now that every writer populates the column. Also drop the `?` from `patchConfigId` in the owner types and the `TODO`-marked guards it forced in `apiRoutes/{charts,narrativeCharts}.ts` | red |
| 9 | `🔨🤖 read config instead of full` | the mechanical sweep across 34 files, the six `cc.patch` → `patchConfigId` joins, and the `patch: "{}"` test fixtures | **green** — and the acceptance greps below return nothing outside `db/migration/` |
| 10 | `✅🤖 cover the two-row write invariants` | a save writes both rows with equal `updatedAt`; a delete removes both; an indicator change re-merges the resolved row from the patch row | green |
| 11 | `📜🤖 document the single config column` | the six `db/docs/` files, plus the `chart_revisions.yml` correction | green |

Notes on the shape:

- **Commit 1 is independently deployable.** If PR 1 has to be split under
  time pressure, it is the natural seam: pointers and patch rows can live in
  production for a while with nothing reading them.
- **Commits 2–8 are red**, and that is inherent rather than sloppy: the column cannot
  be renamed before the code reads the new name, and the code cannot read it before
  the column exists. Nothing bisects usefully inside that span, so keep the span
  tight and don't reorder it.
- **Commit 4 produces one of the two inventories** (see below), not the whole one.
- **Commit 9 must be boring.** If reviewing it turns up anything that isn't a
  column rename or a pointer join, that thing belongs in 5–8 instead. The greps
  below are the acceptance test.
- The orphan sweep script from the work order folds into commit 8, next to the
  delete paths it backstops.

Sign the PR body per `CLAUDE.md`: concise human-facing summary, then a `<details>`
block with the file-by-file breakdown and the two verification queries.

Before merge: `yarn typecheck`, `yarn test run`, `make dbtest`, `yarn testLintChanged`,
`yarn testFormatChanged`. On staging (`yarn query -s`): confirm the md5 assertion
passed, then load a standalone chart, an mdim view, a narrative chart embed and an
explorer view, and confirm chart-diff shows nothing.

### PR 2 — the ETL PR

Scoped by [`chart-configs-etl-scan-brief.md`](./chart-configs-etl-scan-brief.md),
a self-contained brief for an agent working in the ETL repo — it carries the search
recipe, the risk classes, and the trick that turned up a live bug on the grapher
side.

`config`/`configMd5`, patches via the new pointers, the new FK column names, and
the `etl/analytics/data.py:375` slug join. The ETL's side is read-only
(`SELECT`/`JOIN` only against `chart_configs`; all writes go over HTTP through
`apps/chart_sync/admin_api.py`), which is what makes the window below tolerable.

## Verification

**Before PR 2 is written, and inside PR 1's migration at step 3** — the backfill
must be exact, for each of the three owners:

```sql
SELECT COUNT(*) FROM charts c
  JOIN chart_configs r ON r.id = c.configId
  JOIN chart_configs p ON p.id = c.patchConfigId
WHERE p.config <> r.patch;   -- must be 0
```

**No hash churn** — the claim that this needs no archive re-bake, no R2 re-upload
and produces no phantom chart-diffs rests entirely on it, so it is asserted inside
the migration (steps 5 and 9) rather than left to a rehearsal:

```sql
-- step 5, while `full` is intact
CREATE TABLE tmpChartConfigMd5Before (id char(36) PRIMARY KEY, fullMd5 char(24) NOT NULL);
INSERT INTO tmpChartConfigMd5Before SELECT id, fullMd5 FROM chart_configs;

-- step 9
SELECT COUNT(*) FROM chart_configs cc
  JOIN tmpChartConfigMd5Before prev ON prev.id = cc.id
WHERE cc.configMd5 <> prev.fullMd5;                     -- must be 0
SELECT COUNT(*) FROM tmpChartConfigMd5Before prev
WHERE NOT EXISTS (SELECT 1 FROM chart_configs cc WHERE cc.id = prev.id);   -- must be 0
```

`prev`, not `before` — `BEFORE` is reserved. The second query matters because a row
present before and missing after would slip past the join in the first.

**Verified on the dev snapshot: 0 of 261,211 rows changed hash, and 0 went
missing.** Also worth checking: the row count is `253,786 + 14,688 = 268,474`, and
`SELECT COUNT(*) FROM chart_configs WHERE config IS NULL` is 0.

## Rollback

PR 1's `down()` is mechanical because the patch rows hold everything `patch` held:

```sql
ALTER TABLE chart_configs ADD COLUMN patch JSON NULL;
UPDATE chart_configs r JOIN charts c ON c.configId = r.id
  JOIN chart_configs p ON p.id = c.patchConfigId SET r.patch = p.config;
-- same for multi_dim_x_chart_configs and narrative_charts
UPDATE chart_configs SET patch = config WHERE patch IS NULL;  -- variables, explorer views
ALTER TABLE chart_configs MODIFY patch JSON NOT NULL;
```

…then reverse the rename, restore the three `STORED` columns over `full`, delete
the patch rows, drop the pointers, and revert the FK renames. Write and rehearse
this, don't just assume it — it is the reason this can be one release.

Rolling back the *code* without the migration is also survivable in the write
direction: old code doing `SET patch = ?, full = ?` fails loudly on missing
columns rather than corrupting anything.

## For the PR description: behaviour changes

A running list. Most of this refactor is meant to be invisible, so anything that
*isn't* has to be called out where a reviewer or an on-call person will see it. Add
to this list as commits land.

- **`GET /admin/api/chart-configs/:chartConfigId.config.json` returns the config
  instead of the whole row.** The route's name always implied a config; it served a
  `chart_configs` row and its one caller reached through for a single field.
  Admin-authenticated, single in-repo consumer
  (`adminSiteClient/CreateNarrativeChartEditorPage.tsx`), updated in the same commit.
  Not verified against the ETL, which does talk to `/admin/api` — but via
  `apps/chart_sync/admin_api.py`, documented as the write path.
- **ETL SQL against `chart_configs` breaks between the PR 1 and PR 2 deploys.**
  Queries naming `full`, `fullMd5`, `patch` or `variables.grapherConfigId{ETL,Admin}`
  fail. Read-only, so it is failed steps and retries rather than damage — but hold
  chart-sync across the window if it can fire in it.
- **One write-blocking `ALTER` during deploy.** Rebuilding `chart_configs` to add the
  STORED generated columns blocks writes to that table for tens of seconds. Reads
  continue; the admin fails loudly and briefly.
- **~14,700 new objects in R2 `config/by-uuid/`,** each an authored layer rather than
  a whole config. Consistent with the 222,708 indicator configs already published
  that way, and nothing links to them.
- **Every config write now touches two rows,** so deleting an owner has to clean up
  both. The orphan surface doubles, and one source is outside grapher entirely
  (`etl/grapher/to_db.py` deletes from `multi_dim_x_chart_configs` directly).
- **The effective indicator config is merged in code, not stored.**
  `variables.grapherConfigIdAdmin`'s resolved row is gone; the value is now
  `merge(etl, admin)` behind one shared helper. Same result, computed instead of
  persisted — and it deletes the two hand-rolled merges that existed because there
  were two ways to get it.

## What is being accepted

**One write-blocking `ALTER`.** Step 7 is a `COPY` rebuild of a ~210 MB table:
reads continue, writes to `chart_configs` block for the duration — expect tens of
seconds. The admin fails loudly and briefly. This is the cost of keeping the
generated columns `STORED`; making them `VIRTUAL` would make the whole migration
online, at the price of computing md5/slug/chartType on every read. We chose
`STORED` to avoid smuggling an unmeasured performance change into a schema
refactor.

**A window where ETL SQL errors**, between the PR 1 deploy and the PR 2 deploy.
Queries referencing `full`, `fullMd5`, `patch` or the old FK column names fail.
Because the ETL only reads, this is failed steps and retries, not damage.

**Decided: no compatibility shims.** The window is short enough that failed,
retryable ETL reads are cheaper than carrying temporary `VIRTUAL` aliases for
`full`/`fullMd5` and the renamed FK columns through a release. PR 2 follows PR 1
directly.

**Analytics double-counting during the window.** The ETL's slug join is unfixed
until PR 2, so it over-counts published charts for as long as the window lasts.
Analytics only, self-correcting.
