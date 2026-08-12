# Target schema: one config per `chart_configs` row

_The end state of replacing `chart_configs.patch` + `chart_configs.full` with a
single `config` column. This doc is about the **destination only** — no
migration steps, no phasing. For how configs are layered today, see
[`chart-configs-current-model.md`](./chart-configs-current-model.md); for the
earlier migration write-up see
[`chart-configs-refactor-plan.md`](./chart-configs-refactor-plan.md), which
differs from this doc on one point flagged below. Row counts are from the dev
DB snapshot of 2026-08-10._

**Scope.** This refactor is the `patch`/`full` → `config` move and the pointers
that move implies, and nothing else. Where a neighbouring oddity turned up during
the audit it is recorded here as "unchanged, and why" rather than folded in.

**How to get there:** [`chart-configs-migration.md`](./chart-configs-migration.md).

## The invariant

> **A `chart_configs` row is a config. The foreign key that names it says which
> kind: it either names the config that renders, or an authored layer that gets
> merged into one.**

That is the whole conceptual fix. Today a reader has to know, per owner, whether
`patch` means anything on a given row — it is variously a duplicate of `full`,
an authored delta, or a composed authored config. Moving that distinction into
the *pointer name* means a query no longer has to pick a column, and a row no
longer has to know its own role.

Stated as a naming rule: **`patchConfigId` marks an authored layer on a table that
also has a resolved config; `chartConfigId` names the config itself.**

| pointer                                     | names                                    |
| ------------------------------------------- | ---------------------------------------- |
| `charts.configId`                           | the config that renders                  |
| `multi_dim_x_chart_configs.chartConfigId`   | ″                                        |
| `narrative_charts.chartConfigId`            | ″                                        |
| `explorer_views.chartConfigId`              | ″ (nullable — NULL when generation failed) |
| `charts.patchConfigId`                      | the layer the chart editor authored      |
| `multi_dim_x_chart_configs.patchConfigId`   | the layer the mdim YAML authored         |
| `narrative_charts.patchConfigId`            | the layer the narrative editor authored  |
| `variables.chartConfigIdETL`                | the ETL-authored indicator layer         |
| `variables.chartConfigIdAdmin`              | the admin-authored indicator layer       |
| `multi_dim_redirects.viewConfigId`          | another entity's config, used as a key    |

Two things the table shows that are worth stating outright:

- **`variables` needs no `patch` prefix**, because it has no resolved config to
  distinguish an authored layer from — both its pointers are authored layers, and
  the `ETL`/`Admin` suffix says which. Naming them `patchConfigId*` would imply a
  resolved sibling that does not exist.
- **`charts.configId` is the one exception**, and deliberately: it predates the
  convention, is referenced by [#6825](https://github.com/owid/owid-grapher/pull/6825)
  and [etl#6511](https://github.com/owid/etl/pull/6511), and appears in dozens of
  joins. Renaming it to `chartConfigId` would also break its pairing with
  `patchConfigId`, where the useful distinction is the layer, not the subject.

`configId` was considered for the other owners and rejected: `config` alone is
under-specified beside the other things this schema calls a config
(`explorers.config`, `multi_dim_data_pages.config`), and `explorer_views` sits
directly next to one of them.

## Schema

```
chart_configs   id, config JSON, configMd5, slug, chartType, createdAt, updatedAt
```

One JSON column. `slug`, `chartType` and `configMd5` keep exactly today's
generated-column expressions, just over `config`.

`fullMd5` becomes `configMd5` for free: the convention in this DB is to name an
md5 column after the column it hashes (`multi_dim_data_pages.configMd5`,
`explorers.configMd5`, `posts_gdocs.contentMd5`,
`narrative_charts.queryParamsForParentChartMd5`), so renaming the JSON column
renames the hash with it. A bare `md5` would be the only such column in the
schema that doesn't say what it hashes.

For every row an owner names with `configId`, `config` is what `full` is today,
**byte for byte**. That matters because config UUIDs are public and some of the
places they appear cannot be taken back (see below): identical bytes mean
identical md5s, so no archive re-bake, no re-upload of the R2 object, and no
phantom chart-diffs.

### Pointers

| owner                       | pointer(s)                              | rows   |
| --------------------------- | --------------------------------------- | ------ |
| `charts`                    | `configId` + `patchConfigId`            | 5,182 + 5,182 |
| `multi_dim_x_chart_configs` | `chartConfigId` + `patchConfigId`       | 9,204 + 9,204 |
| `narrative_charts`          | `chartConfigId` + `patchConfigId`       | 302 + 302 |
| `explorer_views`            | `chartConfigId` (nullable, as today)    | 9,113 |
| `variables`                 | `chartConfigIdETL` + `chartConfigIdAdmin` | 222,708 + 2 |

`charts.configId` keeps its name and meaning: a 1:1 `UNIQUE NOT NULL` pointer to
the chart's final config, and the chart's public identity. The other owners keep
`chartConfigId`; only `variables` is renamed, from `grapherConfigId{ETL,Admin}`.

`variables` has **no** `configId`. Both its rows are authored layers, and the
effective indicator config is computed in code — see below. Only 2 variables have
an admin-authored config today (against 222,708 ETL ones), but the write path is
live and cheap to use (`PUT /api/variables/:id/grapherConfigAdmin` and the bulk
`updateVariableAnnotations` grid editor), so it carries real weight despite the
row count.

`multi_dim_redirects.viewConfigId` is **unchanged**. It points at
`chart_configs` because the config UUID is the only handle for a view that exists
in the mdim config JSON: views in `multi_dim_data_pages.config` carry
`fullConfigId`, and both the admin UI and URL resolution key off it
(`adminSiteServer/apiRoutes/mdims.ts:47-49`,
`packages/@ourworldindata/utils/src/MultiDimDataPageConfig.ts:187`).
`multi_dim_x_chart_configs.id` is an auto-increment that appears nowhere in that
JSON, so pointing there would add a lookup to every redirect resolution to
recover something the config already states. It names a resolved config, so it
already satisfies the naming rule.

### What each pointer means

| pointer                                    | meaning                                                                                       |
| ------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `charts.configId`                          | the served standalone chart config; the chart's public identity (R2 by-uuid, thumbnails, slug) |
| `charts.patchConfigId`                     | the editor-authored delta against the indicator parent                                        |
| `multi_dim_x_chart_configs.chartConfigId`  | the served mdim view config                                                                   |
| `multi_dim_x_chart_configs.patchConfigId`  | the YAML-authored view config; read on indicator change to re-merge                            |
| `narrative_charts.chartConfigId`           | the served narrative chart config                                                             |
| `narrative_charts.patchConfigId`           | the editor-authored delta against the parent chart or mdim view                                |
| `explorer_views.configId`                  | the fully materialized generated view config; NULL when generation errored                     |
| `variables.chartConfigIdETL`               | the ETL-authored indicator config — root of every chain                                        |
| `variables.chartConfigIdAdmin`             | the admin-authored delta against the ETL config                                                |

Note that most of the table is authored layers, not resolved configs: 237,398
`patchConfigId*` rows against 23,801 `configId` rows. That inversion has a
practical consequence for R2 (hazard 3).

## What gets dropped

**`variables` loses its resolved admin row.** Today `grapherConfigIdAdmin.full`
stores `merge(etl, admin)`; that becomes a merge in code behind a single shared
helper. This is a net deletion rather than a cost: the two hand-rolled
`merge(etl.patch, admin.patch)` reconstructions that exist today
(`db/model/ExplorerViews.ts:135`, `baker/siteRenderers.tsx:649`) exist *because*
there were two ways to get this value. After the change there is one.

**The duplicated JSON goes away.** 507,572 JSON blobs become ~268,000; roughly
210 MB of JSON becomes ~125 MB.

**The paired-column types dissolve.** `DbEnrichedChartConfig`,
`parseChartConfigsRow`, `serializeChartsRow`, and the trio
`updateExistingConfigPair` / `updateExistingPatchConfig` /
`updateExistingFullConfig` all collapse. The pair-writing helper moves up a
level: writing two rows becomes an owner-level concern ("write this chart's
configs"), not a `chart_configs`-level one.

## When does a patch row exist?

**Always.** `patchConfigId` is `NOT NULL UNIQUE` with an FK on all three owners —
the same shape `charts.configId` already has. Every chart, mdim view and narrative
chart has exactly two config rows, unconditionally.

That is 14,688 patch rows, of which ~6,800 are **byte-identical to their resolved
row** (4,522 charts with inheritance disabled, 2,044 mdim views whose indicator
has no config, 1 narrative chart). For those, the duplication moves from two
columns to two rows rather than disappearing. Accepted, because the alternatives
are worse:

- **Nullable, keyed on byte equality** — a save that happened to converge would
  delete the row and the next save would mint a fresh UUID, so chart-sync would
  see timestamp churn on charts nobody touched.
- **Nullable, keyed on `charts.isInheritanceEnabled`** — cheaper (660 chart patch
  rows instead of 5,182), but it couples the schema to a flag whose meaning is an
  editor concern, stores one fact in two places, and needs a `CHECK` constraint to
  keep them from drifting. That is a change to how inheritance is modelled, which
  is above this refactor.

`charts.isInheritanceEnabled` is therefore **untouched and uncoupled**: it stays
exactly what it is today — the gate on the propagation query
(`db/model/Variable.ts:258`), the editor's toggle
(`adminSiteClient/EditorDebugTab.tsx:85`), and a column in the chart list and API.
Whether a chart has a patch row says nothing about whether it inherits.

The storage win barely moves either way: the bulk of today's duplication is the
222,708 indicator rows, all of which collapse to a single blob regardless.

## Config UUIDs are public — the constraint this design answers to

`functions/grapher/by-uuid/[uuid].ts` serves `.config.json`, `.png` and `.svg`
publicly and CORS-open. Four of the fourteen user-facing UUID surfaces cannot be
taken back once written: archive URLs (immutable by design), analytics history in
a third-party store, Algolia records, and any URL a reader or colleague has
copied. See
[`chart-configs-current-model.md`](./chart-configs-current-model.md#where-config-uuids-are-user-facing)
for the full inventory.

**So no existing UUID may be minted, reassigned, or repointed at different
content.** This design satisfies that by construction: every current row keeps
its id and its bytes, and only the new patch rows get fresh UUIDv7s, which
nothing links to.

Every user-facing surface resolves a UUID to a *final* config. None of them ever
addresses a patch. That is the argument for `config` holding the final layer.

## Hazards to settle before writing code

Ordered by how badly they bite.

### 1. The by-slug R2 sync can publish a patch config at a public slug URL

`devTools/syncGraphersToR2/syncGraphersToR2.ts:247-253` selects from
`chart_configs` alone:

```sql
select slug, fullMd5, id from chart_configs
where slug is not null and full ->> '$.isPublished' = "true"
```

A published chart's patch row carries **both** `slug` and `isPublished` —
`diffGrapherConfigs` force-keeps them
(`packages/@ourworldindata/utils/src/grapherConfigUtils.ts:12-20`). Verified: all
4,444 published charts have both set in `patch` today. Two rows therefore match
for one slug, and the results land in a `Map` keyed by
`config/by-slug/<slug>.json`: last write wins, ordered by whatever MySQL returns.
**Every published chart's config object becomes nondeterministic across runs**,
and a patch config renders as a broken chart.

Note this is why `patchConfigId NOT NULL` makes the hazard bigger than the
nullable variants would: it is all 4,444 published charts, not just the 660 that
inherit.

`idx_chart_configs_slug` is non-unique, so the DB will not catch this. No error,
no failing test — just a wrong config on production charts. Gate the query on
`JOIN charts c ON c.configId = cc.id`, which is more correct today too.

Two more sites read `chart_configs.slug` without going through an owner. ETL
`etl/analytics/data.py:375` wants the same join. `db/model/Post.ts:302` turns out
to need no change — it is protected by the inner `chart_dimensions` join, by
`SELECT DISTINCT`, and by the fact that a chart patch row's slug always equals its
resolved row's slug; see `chart-configs-migration.md` for the full audit.

### 2. The orphan surface doubles, and orphans are invisible

Owner→config FKs cannot cascade in the useful direction, so every delete is:
owner row first, then both config rows. Miss one and nothing points at the
leftover — which is how today's 7,275 orphans accumulated. `deleteChart`,
`cleanUpOrphanedChartConfigs` (mdim) and the explorer-view refresh all become
pair-aware. Given the track record, add a periodic sweep rather than trusting
every call site to get it right forever.

One orphan source is outside grapher entirely and likely explains part of today's
7,275: `etl/grapher/to_db.py:515` runs `DELETE FROM multi_dim_x_chart_configs
WHERE variableId IN (…)` to release an FK before deleting variables, which already
strands the `chartConfigId` row and will strand the `patchConfigId` row too. A
sweep handles this; asking the ETL to clean up grapher's config rows does not
scale.

### 3. 14,688 new public by-uuid URLs serving partial configs

The by-uuid sync is unfiltered — `select fullMd5, id from chart_configs`
(`syncGraphersToR2.ts:280`) — so new patch rows are uploaded and served. This is
consistent with the 222,708 indicator configs that already work this way, and
UUIDv7 is timestamp-prefixed, so the space is semi-enumerable rather than opaque.

**Decided: accepted.** The sync stays unfiltered and the patch rows are published
like any other row. Filtering to `configId`-named rows only would take R2
`by-uuid` from 253,786 objects to 23,801, but it changes existing behaviour for
the indicator configs and is not part of this refactor.

### 4. Three existing writers touch both columns in one statement

- `saveNewChart` stamps the chart id in with `JSON_SET(cc.patch,'$.id')` **and**
  `JSON_SET(cc.full,'$.id')` (`adminSiteServer/apiRoutes/charts.ts:313`)
- `republishCharts` bumps `$.version` in both
  (`adminSiteServer/apiRoutes/datasets.ts:559`)
- `updateExistingConfigPair` (`db/model/ChartConfigs.ts`)

Each becomes two statements on two rows, and both rows must get the **same
`updatedAt`**. There are already code comments about chart-sync breaking on
timestamp skew between tables (`db/model/Variable.ts`: "the inconsistency caused
issues in the past in chart-sync"); this adds a new pair that can skew.

### 5. The renames are in scope and need a paired ETL PR

**Decided: all the renames land in this refactor**, which means a coordinated ETL
PR ships with it.

One rename: `variables.grapherConfigIdETL`/`grapherConfigIdAdmin` →
`chartConfigIdETL`/`chartConfigIdAdmin`. The other owners keep `chartConfigId` —
see the naming rule at the top for why `configId` was rejected for them.

It is ETL-visible: those columns live in the ETL's ORM (`etl/grapher/model.py`) on
a 222k-row table. `narrative_charts.chartConfigId` keeps its name, so
`NarrativeChart.load_patch_config` only has to follow the new patch pointer, not a
renamed column.

The ETL's side is read-only, which bounds the work: direct SQL against
`chart_configs` is `SELECT`/`JOIN` only (`etl/grapher/io.py:721`, `:791`,
`etl/analytics/data.py`, `etl/grapher/model.py:2056`, and the skill scripts), and
`ChartConfig` in `etl/grapher/model.py:330` is a read-side ORM mapping nothing
ever constructs. Every config *write* goes over HTTP through
`apps/chart_sync/admin_api.py`, so grapher owns materializing and hashing both
rows. The one ETL write in this area doesn't touch `chart_configs`:
`etl/grapher/to_db.py:515` does `DELETE FROM multi_dim_x_chart_configs WHERE
variableId IN (…)` to release an FK before deleting variables — worth noting only
because that table gains a `patchConfigId`, so those deletes will start orphaning
patch rows (see hazard 2).

### 6. `charts_x_parents` gets a free deletion, not a repoint

Its CTE selects `cc.patch as patchConfig` but the outer `SELECT` never projects
it (`db/migration/1768494494681-FixChartsXParentsViewNullChartType.ts`). Drop the
reference rather than routing it through `patchConfigId`. This is the one
divergence from the earlier plan, which lists it as a repoint.

### 7. Where this design's ambiguity will first bite: #6826

**Decided: #6826 lands after this refactor**, so its column arrives as
`charts.patchConfigIdETL` and no rename is needed.

It makes `charts` a three-pointer table — `configId` + `patchConfigId` +
`patchConfigIdETL`, merging `(indicator, etlChartLayer, patch)`. The naming rule
still holds, but that is the point where "patch means slightly different things per
owner" stops being free. Accepted for now; see
`docs/etl-chart-config-layer-plan.md`.

## Accepted imprecision

`patchConfigId` is a mild lie for two owners, and we are accepting it:

- **mdim views** store a *composed authored config*, not a delta:
  `merge(viewYamlConfig, {$schema, dimensions, defaultSelection})` plus
  `isPublished` (`adminSiteServer/multiDim.ts:284-289`).
- **`variables.chartConfigIdETL`** has no parent at all — it is the root layer,
  "patch" only in the sense of being a partial config meant to be merged.

The alternative was to remove both cases (recompute the mdim view's authored
config from `multi_dim_data_pages.config`, which already stores it; make
narrative charts explicit snapshots and drop their patch entirely), leaving
`patchConfigId` meaning exactly one thing and only `charts` and `variables`
holding authored layers. That is a larger behavioural change — it decides whether
narrative charts snapshot or inherit, and moves the mdim re-merge onto re-derived
input — and it is deliberately **not** part of this refactor.

## Rejected alternatives

- **A discriminator column on `chart_configs`.** The pointer name already carries
  the role; the row does not need to know it, and the slug audit in hazard 1
  shows it does not have to.
- **A self-FK `chart_configs.patchConfigId`, so owners keep one pointer.** Tidier
  FKs, but it puts the two meanings back inside `config` — head row resolved,
  tail rows authored — which is exactly what this refactor removes.
- **`config` = the patch, resolve the merge on read.** Kills the generated
  columns, the R2 hashing, the ~235 sites reading `full->>'$.isPublished'` /
  title / slug, and bake performance.
- **A `patch` JSON column on each owner table.** Config JSON belongs in
  `chart_configs`; that is the point of the table.
- **Deriving chart patches by diffing against the parent.** Loses which keys a
  human deliberately pinned: a key whose value coincides with the parent's would
  silently start following the parent. Three consumers depend on the stored chart
  patch: the editor's inherited-vs-overridden UI, ETL
  `etl/indicator_upgrade/indicator_update.py`, and `chart_revisions.config`, which
  snapshots the patch on every admin save
  (`adminSiteServer/apiRoutes/charts.ts:493`).

## A note on where config JSON lives

`db/docs/chart_configs.yml` says `chart_configs` is "the only place in our database
where actual grapher config JSON blobs are stored". That is very nearly true and is
the right mental model for this refactor, but **`chart_revisions.config` is a second
home**: a per-save snapshot of the chart's patch, used only to render diffs in the
admin's history tab. It needs no schema change here — the patch still exists, just in
a row rather than a column — but it is a write site that never mentions
`chart_configs`, so it is easy to miss. Its own table docs currently describe it
incorrectly; see the doc pass in
[`chart-configs-migration.md`](./chart-configs-migration.md).

## Follow-up work: can any of the new patch rows be deleted?

This refactor gives every chart, mdim view and narrative chart an authored config
row unconditionally — 14,688 of them — on the grounds that the pointer should not
have to mean "sometimes". Worth checking afterwards how many actually earn their
keep, because the reasons differ per owner and two of them look weak:

- **~6,800 duplicate their resolved row byte for byte** (4,522 charts with
  inheritance disabled, 2,044 mdim views whose indicator has no config, 1 narrative
  chart). For these the authored config *is* the resolved config, so the second row
  stores nothing new. That was accepted to keep `patchConfigId NOT NULL` and avoid a
  nullable column whose meaning shifts on every save — but it is the largest single
  block of new rows.
- **mdim views may not need one at all.** The authored view config is already in
  `multi_dim_data_pages.config` — `merge(viewYamlConfig, {$schema, dimensions,
  defaultSelection})` plus `isPublished` — so the row is a cache of something the
  mdim config already states. Its only reader is the indicator propagation loop.
  9,204 rows.
- **narrative-chart rows are read only to reopen the editor.** Nothing propagates to
  them, so their authored config is never re-merged; see the note on whether
  narrative charts should snapshot or inherit. 302 rows.

Charts are the one owner where the case is solid: the editor's inherited-vs-overridden
UI and the ETL's `indicator_upgrade/indicator_update.py` both read the stored chart
patch, and re-deriving it would hand coincidental keys back to the parent.

Anything dropped here also removes rows from the public metadata dump and from R2
`config/by-uuid/`, so it is worth settling before those become something people rely
on.

## Follow-up work: why is the admin indicator layer stored as a diff?

`updateGrapherConfigAdminOfVariable` does not store what the admin authored. It
stores `diffGrapherConfigs(validConfig, etl.config)` — the delta against the ETL
layer — even though the admin UI submits a whole config
(`db/model/Variable.ts`). Worth understanding properly, because it makes this the
only *stored* config in the table that is derived rather than authored, and that
asymmetry has consequences the rest of the model deliberately avoids:

- **A coincidental value disappears.** A key whose admin value happens to equal the
  ETL value is dropped from the delta, so it silently starts following the ETL layer
  on that layer's next change. This is the exact hazard cited as the reason *not* to
  derive chart patches (see "Rejected alternatives"), accepted here without the same
  scrutiny.
- **Every other authored layer stores what was authored.** Charts, mdim views and
  narrative charts all keep the author's own contribution; only this one is reduced.

But the diff is probably load-bearing rather than incidental, which is why this
needs looking at rather than just changing: `mergeVariableChartConfigs` merges the
admin layer *over* the ETL one, so if the admin layer held a whole config it would
mask everything the ETL sets, not only the keys someone changed. The diff is what
makes partial override work at all. Any replacement has to preserve that — probably
by recording which keys the admin set, rather than by inferring it from equality.

Only 2 variables have an admin config today, so nothing is on fire; see the
follow-up on dropping the column entirely, which would make the question moot.

## Follow-up work: delete the orphaned `chart_configs` rows

**Deliberately not part of this refactor.** 7,267 rows are referenced by nothing at
all. Deleting them was originally folded into the migration, on the grounds that it
shrinks the table copy — but that is 2.7% of the rows, worth about a second of a
30–60s rebuild, and it is the only irreversible operation in the whole plan. It has
no other coupling: the orphans survive the rename as ordinary rows, they don't
affect the md5 verification, the backfill doesn't touch them, and R2 keeps syncing
them exactly as it does today. So it belongs in its own PR, reviewed on its own.

Two things the investigation turned up that a future attempt needs:

- **Twelve columns name a `chart_configs` row, and two of them have no foreign
  key** — `explorer_view_dimensions.chartConfigId` and
  `multi_dim_view_dimensions.chartConfigId`. Checking only the ten FK-backed columns
  gives 7,275 rows; including these two gives **7,267**. The 8-row difference is real:
  those configs are still pointed at, and deleting them would leave dangling rows
  behind. (`analytics_chart_views.view_config_id` is correctly excluded — it is
  imported view-count data keyed by config id, not a reference into the table.)
- **Those 8 rows are themselves a symptom.** All are held by
  `multi_dim_view_dimensions` rows whose `multi_dim_x_chart_configs` row is already
  gone — consistent with `etl/grapher/to_db.py:515` deleting from that join table
  directly without touching the dimensions side-table. Worth cleaning up together,
  and an argument for the orphan sweep in hazard 2.

Recovery path if it ever goes wrong: until the next `syncGraphersToR2` run prunes
them, R2 still holds each config at `config/by-uuid/<id>.json`. That is the only one
— the rows cannot be reconstructed from anything left in the database.

## Follow-up work: drop `variables.grapherConfigIdAdmin`

**Not part of this refactor.** Recorded here because the audit that motivated the
refactor turned up the evidence, and because the target schema is deliberately
agnostic about it.

The admin-authored indicator config layer has been used **twice**, ever, and
neither instance affects anything that renders:

| variable                                                   | created    | contents                                                                                            |
| ---------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------- |
| 985021 — Mpox, "Total confirmed deaths"                     | 2024-09-11 | `$schema`, `dimensions`, `selectedEntityNames: ["Brazil"]` — no ETL config underneath, so patch == full |
| 1031404 — UNESCO, "Literacy rate among young people (15–24)" | 2026-03-09, updated 2026-05-18 | `title`, `subtitle`, `chartTypes: [SlopeChart]`, `timelineMaxTime`, `selectedEntityNames`, `hideAnnotationFieldsInTitle` — the one row in the table whose admin patch differs from the merged result |

Neither variable is used by a single chart (`chart_dimensions` count 0 for both),
has any inheriting chart or mdim view, or has a datapage. Neither reaches R2
`config/by-slug/` — the UNESCO row's `slug` is the empty string and its
`isPublished` is null. The only public surface is incidental: both rows are
fetchable at `/grapher/by-uuid/<id>.config.json`, exactly like the 222,708 ETL
indicator configs, with nothing linking to them.

**Why it is a separate piece of work, not a schema cleanup.** Dropping the column
deletes two admin features rather than simplifying a table. `grapherConfigIdAdmin`
is what the indicator chart editor (`adminSiteClient/IndicatorChartEditor.ts`,
`PUT /api/variables/:id/grapherConfigAdmin`) and the variable-annotation grid
editor (`adminSiteClient/VariablesAnnotationPage.tsx` →
`updateVariableAnnotations` → `updateGrapherConfigAdminOfVariable`) exist to write;
the grid editor largely loses its purpose without it. Thirteen files reference it.

**What makes it cleanly separable:**

- The target schema is unchanged either way. `variables` has two authored-layer
  pointers and no resolved row; dropping the admin one removes a pointer and
  collapses the shared effective-config helper from two layers to one.
- No ETL work. The ETL reads chart and narrative-chart patches, never the variable
  admin patch.
- **No second rename.** `variables.chartConfigIdETL` keeps its suffix — it is
  provenance, and after #6826 the same suffix exists on `charts.patchConfigIdETL`.
  Renaming to a bare `patchConfigId` would cost a second ETL-coordinated rename for
  a cosmetic gain.

**Open question for the team, not for the code:** the UNESCO config is deliberate
editorial work from May 2026, and dropping the column discards it unless it moves
into the ETL config or a chart. There is no attribution in the DB —
`chart_configs` has no user column and `chart_revisions` only covers charts — so
someone has to ask. The Mpox row is disposable.
