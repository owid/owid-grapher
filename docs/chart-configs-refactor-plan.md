# Plan: one config per `chart_configs` row

_Replace `chart_configs.patch` + `chart_configs.full` with a single `config`
column. Row counts below are from the dev DB snapshot of 2026-08-10._

## Why

`chart_configs` is the only place grapher config JSON is stored, and today every
row stores its config twice — once as the authored delta (`patch`), once as the
merged result (`full`). For most rows those two are byte-identical:

| owner of the row                  |    rows | `patch` = `full` |
| --------------------------------- | ------: | ---------------: |
| `variables.grapherConfigIdETL`    | 222,708 |          222,708 |
| `multi_dim_x_chart_configs`       |   9,204 |            2,044 |
| `explorer_views`                  |   9,113 |            9,113 |
| `charts`                          |   5,182 |            4,784 |
| `narrative_charts`                |     302 |                1 |
| `variables.grapherConfigIdAdmin`  |       2 |                1 |
| orphaned (referenced by nothing)  |   7,275 |                — |
| **total**                         | 253,786 |  240,274 (94.7%) |

Only ~7,600 rows in the whole database have two genuinely different layers, and
they sit in three owners: charts (398), mdim views (7,160), narrative charts
(301). Everything else pays for a second JSON copy it never uses — roughly 90 MB
of the table's ~210 MB of JSON.

The second cost is conceptual: a reader of the table has to know, per owner,
whether `patch` means anything, and every query has to pick a column. Two
existing sites read `patch` where they want the merged config
(`baker/siteRenderers.tsx:603`, `db/model/ExplorerViews.ts:90`) and reconstruct
the merge by hand.

## Target schema

```
chart_configs   id, config JSON, configMd5, slug, chartType, createdAt, updatedAt
```

One JSON column. `slug`, `chartType` and `configMd5` keep exactly today's
generated-column expressions, just over `config`. **A row does not know its role
— the pointer that names it does:**

```
charts                      configId (final, unchanged) + patchConfigId
                            (+ configIdETL from #6826, a third layer pointer)
narrative_charts            chartConfigId (final)       + patchConfigId
multi_dim_x_chart_configs   chartConfigId (final)       + patchConfigId
variables                   grapherConfigIdETL   (single row, no layer)
                            grapherConfigIdAdmin (final merged config)
explorer_views              chartConfigId        (single row, no layer)
```

Net: 231,821 rows lose a duplicated column and gain nothing; 14,688 patch rows
are added (5,182 + 9,204 + 302); 7,275 orphans are deleted.

### `config` holds the final layer

For the row an owner's primary pointer names, `config` is what `full` is today,
byte for byte. That is the layer that:

- the generated columns describe (`slug`, `chartType`, `configMd5`),
- R2 serves at `config/by-uuid/<id>.json` and `config/by-slug/<slug>.json`,
- `archived_chart_versions.hashOfInputs` and the ETL's chart-diff checksum hash,
- and ~235 of the ~250 non-migration query sites read.

Keeping the bytes identical means no md5 churn: no archive re-bake, no re-upload
of 250k R2 objects, no phantom chart-diffs.

### `charts.patchConfigId`, not `fullConfigId`

`charts.configId` is already `UNIQUE NOT NULL` with an FK — a 1:1 pointer to the
chart's final config, and the chart's public identity (see below). It keeps its
name and meaning; the new pointer is the added one.

### No discriminator column on `chart_configs`

A patch row for a published chart carries the same `slug` as its chart's final
row: `slug` and `isPublished` are in `KEYS_EXCLUDED_FROM_INHERITANCE`
(`packages/@ourworldindata/utils/src/grapherConfigUtils.ts:14`), so
`diffGrapherConfigs` force-keeps them in the patch. All 4,444 published charts
have `patch->>'$.slug'` set. So the generated `slug` will have 5,065 duplicate
pairs.

Audited every consumer of `chart_configs.slug`. Three need a change; the rest
already resolve slugs through `charts` and are unaffected:

**Fix**

- `devTools/syncGraphersToR2/syncGraphersToR2.ts:250` — selects by slug from
  `chart_configs` alone, so two rows would compete for the same
  `config/by-slug/<slug>.json` key. Add `JOIN charts c ON c.configId = cc.id`
  (more correct today too).
- `db/model/Post.ts:302` — `LEFT JOIN chart_configs cc ON pl.target = cc.slug`.
  Survives by accident: a patch row's id matches no `charts.configId`, so the
  inner `chart_dimensions` join drops the extra row. Route the join through
  `charts` so it isn't accidental.
- ETL `etl/analytics/data.py:375` — `JOIN chart_configs cc ON pgl.target =
  cc.slug`, same fix.

**Verified safe** — all of these already start `FROM charts JOIN chart_configs ON
charts.configId = chart_configs.id`, or are otherwise constrained to a pointed-at
row: `db/model/Chart.ts:605` (inner-joins `charts`), `db/model/StaticViz.ts:48`
(`c.configId IN (…)`), `db/model/Post.ts:102`, `db/model/Chart.ts:643`/`673`,
`db/model/Gdoc/GdocPost.ts:183`, `baker/redirectsFromDb.ts:31`/`78`,
`adminSiteServer/apiRoutes/redirects.ts:103`, and the four
`analytics_grapher_views agv ON agv.grapher_slug = chart_configs.slug` joins in
`apiRoutes/{charts,datasets,variables,tags}.ts`.

`chartType` on a patch row is likewise only reachable through a pointer join.

### The variable admin patch is derived, not stored

`variables` gets no patch pointer. The admin delta is
`diffGrapherConfigs(adminConfig, etlConfig)`, computed in
`getGrapherConfigsForVariable` (`db/model/Variable.ts:59`) — the single choke
point every consumer goes through: `updateGrapherConfigETLOfVariable`,
`updateGrapherConfigAdminOfVariable`, both `.patchConfig.json` routes
(`adminSiteServer/apiRouter.ts:639-646`), the ETL/admin config delete handlers,
and `apiRoutes/bulkUpdates.ts`. The delete-ETL handler
(`apiRoutes/variables.ts:420`) already loads both configs before deleting the
ETL row, so the reconstruction has its inputs.

Consequence, accepted: a derived patch drops keys whose admin value coincides
with the ETL value, so such a key follows the ETL config on its next change
instead of staying pinned. Two rows in production.

This does **not** extend to charts, mdim views or narrative charts: the chart
editor's inherited-vs-overridden UI and the ETL's
`etl/indicator_upgrade/indicator_update.py` both depend on the stored chart
patch, and re-deriving it would silently hand coincidental keys back to the
parent.

## Config UUIDs are public — the invariant

`functions/grapher/by-uuid/[uuid].ts` serves `.config.json`, `.png` and `.svg`
publicly from R2 `config/by-uuid/`. Consumers: narrative-chart embeds
(`site/multiembedder/MultiEmbedder.tsx:203`), the mdim view fallback
(`site/multiDim/api.ts:43`), search hits (`site/search/searchUtils.tsx:355`),
slideshows, admin dynamic thumbnails, and `archive.ourworldindata.org` manifests,
which are immutable. The admin also addresses configs by UUID
(`/api/chart-configs/:chartConfigId.config.json`), and #6825 extends that to all
`/charts/…` routes.

**So: no existing UUID may be minted, reassigned, or repointed at different
content.** This refactor satisfies that by construction — every current row keeps
its id and its bytes. Only the new patch rows get fresh UUIDv7s, and nothing
links to them.

R2 by-uuid syncs all 253,786 rows today, including the 222,708 partial indicator
configs, so leaving the ~14,700 patch rows in that sync is consistent with
existing behaviour: a partial config at an unguessable UUID. Filtering them out
without a discriminator needs four `NOT EXISTS` clauses; not worth it.

## In-flight PRs

- [#6825](https://github.com/owid/owid-grapher/pull/6825) (address charts by
  config UUID) and [etl#6511](https://github.com/owid/etl/pull/6511) (charts as
  first-class ETL citizens, `chart_config_id` declared in YAML) only touch
  `charts.configId`, which doesn't change. Orthogonal; any order.
- [#6826](https://github.com/owid/owid-grapher/pull/6826) needs no change:
  `charts.configIdETL` is simply a third layer pointer, and its merge chain
  `merge(variableConfig, etlConfig, patch)` reads consistently with the rest of
  the table. See `docs/etl-chart-config-layer-plan.md` for how that layer is
  modelled in the editor.

## Rejected alternatives

- **`config` = the patch, recompute the merge on read.** Kills the ~235 sites
  reading `full->>'$.isPublished'`/title/slug, the generated columns, the R2
  hashing, and bake performance.
- **Two `chart_configs` rows with `isPatch` on the row.** The row shouldn't need
  to know its role, and the slug audit above shows it doesn't have to.
- **A `patch` JSON column on each owner table.** Config JSON belongs in
  `chart_configs`; that's the point of the table.
- **Drop stored chart patches, derive them like the variable admin patch.**
  Changes editor behaviour (coincidental keys read as inherited and start
  following the parent) and breaks ETL `indicator_update.py`.

## Phase 1 — grapher PR

Migration:

1. Delete the 7,275 orphaned rows first (smaller table copy; `syncGraphersToR2`
   prunes their R2 objects on the next run).
2. Drop the generated columns (`slug` and its index, `chartType`, `fullMd5`),
   `RENAME COLUMN full TO config`, re-add `slug`/`chartType`/`configMd5` over
   `config`. MySQL won't rename a column a generated column depends on, hence
   the drop/re-add; the md5 over identical bytes yields identical hashes.
3. Insert 14,688 patch rows from `chart_configs.patch`, minting UUIDv7s in TS
   (the ETL warns on non-v7) and copying `createdAt`/`updatedAt` from the source
   row so chart-sync's timestamp comparisons don't see phantom changes. Add
   `patchConfigId` (`NOT NULL UNIQUE`, FK `ON DELETE RESTRICT`) to `charts`,
   `narrative_charts`, `multi_dim_x_chart_configs`; backfill.
4. Rebuild the three views over `chart_configs`: `charts_x_parents` (reads
   `cc.patch` via `charts.configId` — must join `charts.patchConfigId` instead),
   `chart_references_view` and `datapages` (rename only).
5. Compat shims for the ETL, dropped in phase 3: `full JSON GENERATED ALWAYS AS
   (config) VIRTUAL`, `fullMd5` alongside `configMd5`, and `chart_configs.patch`
   kept in place and dual-written.

This is a ~250 MB table copy, so expect a brief write lock during deploy.

Write paths — a config write becomes two rows in one transaction, and deletes
must clean up both:

- `adminSiteServer/chartConfigHelpers.ts` — `saveNewChartConfigInDbAndR2` /
  `updateChartConfigInDbAndR2` write two rows, one R2 object
- `db/model/ChartConfigs.ts` — `updateExistingConfigPair`,
  `updateExistingPatchConfig`, `updateExistingFullConfig` collapse into one
- `adminSiteServer/apiRoutes/charts.ts` — create, update, **delete**
- `db/model/Variable.ts` — insert/update indicator configs, the two
  `updateAll…ThatInheritFromIndicator` re-merge loops, and the derived admin
  patch
- `db/model/ExplorerViews.ts`, `adminSiteServer/multiDim.ts` (incl.
  `cleanUpOrphanedChartConfigs`, now two rows),
  `adminSiteServer/apiRoutes/narrativeCharts.ts`,
  `adminSiteServer/apiRoutes/bulkUpdates.ts`,
  `adminSiteServer/apiRoutes/datasets.ts` (republish version bump),
  `devTools/refreshExplorerViews.ts`, `jobQueue/explorerJobProcessor.ts`

Read paths:

- mechanical `cc.full` → `cc.config` sweep (~235 sites)
- `cc.patch` reads repoint to a `patchConfigId` join
- `baker/siteRenderers.tsx:603` and `db/model/ExplorerViews.ts:90` replace their
  hand-rolled `merge(etlPatch, adminPatch)` with
  `COALESCE(cc_admin.config, cc_etl.config)`
- the three slug queries listed above

Also: types (`DbInsertChartConfig`, `parseChartConfigsRow`, `serializeChartsRow`,
the owner-table types), `db/docs/` for the six affected tables (including a note
on `variables.yml` that the admin row stores the merged config and the delta is
derived), `make dbtest` + `yarn test`, and a staging check via `yarn query -s`.

## Phase 2 — ETL PR

`etl/grapher/model.py` (`ChartConfig.config`/`configMd5`, patch via the new
pointers, `NarrativeChart.load_patch_config`),
`etl/indicator_upgrade/indicator_update.py`,
`apps/wizard/app_pages/chart_diff/chart_diff.py`, `etl/analytics/data.py` (incl.
the slug join), and the `.claude/skills` scripts that query `patch`/`full`.

The ETL never reads the variable admin patch, only chart and narrative-chart
patches.

## Phase 3 — grapher PR

Drop `chart_configs.patch`, the `full` virtual column, `fullMd5`, and the
dual-writes.

Phases 1 and 2 can land the same day; the shims mean ordering doesn't matter for
readers of `full`. The only readers that break before phase 2 are the ETL's
`patch` consumers, which is why phase 1 keeps dual-writing that column.
