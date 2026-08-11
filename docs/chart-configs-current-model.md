# The current `chart_configs` layering model

_How grapher configs are layered today, what `patch` and `full` mean for each
kind of row, and where config UUIDs are user-facing. Read this before
[`chart-configs-refactor-plan.md`](./chart-configs-refactor-plan.md), which
replaces the two columns with one. Row counts are from the dev DB snapshot of
2026-08-10._

## The one rule that holds everywhere

**`full` is the config that renders.** Every reader that asks "what does this
chart look like" reads `full`; the generated columns (`slug`, `chartType`,
`fullMd5`) are computed over `full`, and R2 serves `full`.

**`patch` is the authored layer, and it only means something if the row's owner
has a parent.** Where there is no parent, `patch` is written byte-identical to
`full` — not derived on read, just duplicated at write time.

The grapher default layer is _not_ a DB layer (it was removed in
`db/migration/1730455806132-RemoveDefaultConfigLayer.ts`); it is applied at
render time. That is why the editor diffs against _parent-with-defaults_
(`adminSiteClient/AbstractChartEditor.ts:219`) while the server diffs against
the bare parent (`adminSiteServer/apiRoutes/charts.ts:261`).

## Chain 1 — indicator level (the root)

Two rows per variable. The effective indicator config is
`admin.full ?? etl.full` — a pick, never a read-time merge
(`db/model/Chart.ts:360`, `db/model/Variable.ts:371`).

| row                    | `patch`                                                                | `full`                                             |
| ---------------------- | ---------------------------------------------------------------------- | -------------------------------------------------- |
| `grapherConfigIdETL`   | = `full`, written twice from one value (`db/model/Variable.ts:406-419`) | the ETL-authored indicator config                  |
| `grapherConfigIdAdmin` | `diff(adminAuthored, etl.full)` — **derived**, not authored (`:491`)    | `merge(etl.patch, patch)` (`:496`)                 |

The ETL row is the root of every chain, so it has no parent and its `patch` is
dead weight for all 222,708 rows. The admin row is the one place in the table
where the patch is computed by the server from a whole config the UI submitted:
the grid editor and `VariableEditPage` author a complete config, not a delta.

**Propagation is why downstream patches must be stored.** Writing either
indicator row re-reads the `patch` of every inheriting chart and mdim view and
re-writes their `full` (`updateAllChartsThatInheritFromIndicator`
`db/model/Variable.ts:275`, `updateAllMultiDimViewsThatInheritFromIndicator`
`:353`).

## Chain 2 — standalone charts

Parent = the effective config of the single y-indicator, if the chart has
exactly one y variable and is not a scatter plot
(`packages/@ourworldindata/utils/src/Util.ts:2357`; the `charts_x_parents` view
is the persisted form of the same rule) — and only if
`charts.isInheritanceEnabled`.

- **`patch`** = `diffGrapherConfigs(authoredConfig, parent)`
  (`adminSiteServer/apiRoutes/charts.ts:261`, `:356`). `diffGrapherConfigs`
  force-keeps `$schema`, `dimensions`, `id`, `slug`, `version` and `isPublished`
  (`packages/@ourworldindata/utils/src/grapherConfigUtils.ts:12-20`), so a
  published chart's patch carries its slug.
- **`full`** = `merge(parent, patch)`.
- Inheritance off ⇒ parent `{}` ⇒ both operations are the identity ⇒
  `patch == full`. That accounts for 4,784 of 5,182 rows.

The client posts its own `patchConfig` and the server re-diffs it against the
parent; idempotent apart from the parent-with-defaults discrepancy above.

## Chain 3 — mdim views

Parent = the effective config of that view's y-indicator
(`adminSiteServer/multiDim.ts:291`). There is no inheritance toggle; mdim views
always inherit.

- **`patch`** = _not a diff_. It is the composed authored config:
  `merge(viewYamlConfig, {$schema, dimensions, defaultSelection})`, plus
  `isPublished` copied from the mdim page (`adminSiteServer/multiDim.ts:284-289`).
  Authored by the mdim YAML, never by a human in an editor.
- **`full`** = `merge(indicatorConfig, patch)` (`:291`).
- The 2,044 identical rows are views whose y-indicator has no config at all.

## Chain 4 — narrative charts

Parent = a standalone chart's `full` (`expectChartById` → `db/model/Chart.ts:243`)
or an mdim view's `full` (`adminSiteServer/apiRoutes/narrativeCharts.ts:118-126`).

- **`patch`** = `diff(config, parentFull)` **plus**
  `NARRATIVE_CHART_PROPS_TO_PERSIST` force-pinned from config-with-defaults, so
  entity selection and friends never drift when the parent changes
  (`adminSiteServer/apiRoutes/narrativeCharts.ts:53-81`; editor side
  `adminSiteClient/NarrativeChartEditor.ts:58`).
- **`full`** = `merge(parentFull, patch)` (`:80`).
- Those force-pinned props are why the patch is almost never equal to the full
  config: 1 of 302 rows.

**Narrative charts are the one chain with no propagation.** Nothing in this repo
recomputes a narrative chart's `full` when its parent chart or the underlying
indicator changes — the two `updateAll…ThatInheritFromIndicator` loops cover
charts and mdim views only. So `full` here is a snapshot taken at
narrative-chart save time, and the stored `patch` is read back only to reopen
the editor (`adminSiteServer/apiRoutes/narrativeCharts.ts:282`).

## Chain 5 — explorer views (not actually a chain)

`patch` and `full` are written byte-identical from a single generated config
(`db/model/ExplorerViews.ts:446-447`, `:478-479`).

The config is _fully materialized_: the refresh job runs the real `Explorer` in
Node, sets each view, and dumps `grapherState.toObject()`, back-filling title
and subtitle from grapher's own fallbacks (`db/model/ExplorerViews.ts:201-210`).

The indicator layer does take part, but only in memory:
`fetchExplorerDataForViews` reads `cc_etl.patch` / `cc_admin.patch` and
hand-merges them into `partialGrapherConfigs`
(`db/model/ExplorerViews.ts:86-136`), which `Explorer` merges under the
explorer's own grapherConfig
(`packages/@ourworldindata/explorer/src/Explorer.tsx:681`). Since the ETL patch
equals its full and the admin full is `merge(etl.patch, admin.patch)`, that
hand-merge is exactly `admin.full ?? etl.full` — a reconstruction of a column
that already exists. The same code is duplicated at
`baker/siteRenderers.tsx:603`.

## Every foreign key into `chart_configs`

Seven, not six — `db/docs/chart_configs.yml` is missing
`multi_dim_redirects.viewConfigId`.

| FK                                        | `full` means                                                          | `patch` means                                                                       |
| ----------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `charts.configId` (UNIQUE NOT NULL)       | the served standalone chart config; also the chart's public identity (R2 by-uuid, thumbnails) | editor-authored diff vs the indicator parent; equals `full` when inheritance is off  |
| `variables.grapherConfigIdETL`            | ETL-authored indicator config, root of all chains                     | duplicate of `full`                                                                 |
| `variables.grapherConfigIdAdmin`          | merged ETL + admin indicator config                                   | server-derived diff vs `etl.full`                                                   |
| `multi_dim_x_chart_configs.chartConfigId` | the served mdim view config                                           | composed YAML-authored view config; **required** for the re-merge on indicator change |
| `narrative_charts.chartConfigId`          | snapshot merge of parent + patch at save time, never refreshed         | diff vs parent + force-persisted props; read only to reopen the editor               |
| `explorer_views.chartConfigId` (nullable) | fully materialized generated view config; NULL when generation errored | duplicate of `full`                                                                 |
| `multi_dim_redirects.viewConfigId` (nullable) | —                                                                 | —                                                                                   |

`multi_dim_redirects.viewConfigId` is a pure identifier: it names _which_ mdim
view a redirect targets, by config id
(`adminSiteServer/apiRoutes/mdims.ts:47-49`, `findViewDimensionsByConfigId`);
NULL means the page's default view. It never reads either JSON column — the only
FK that treats a `chart_configs` row as an opaque key.

Loose end for the migration: `charts_x_parents` selects `cc.patch as patchConfig`
in its CTE but the outer SELECT never projects it
(`db/migration/1768494494681-FixChartsXParentsViewNullChartType.ts`). Dead
reference, but the view text still has to be rebuilt.

## Where config UUIDs are user-facing

Fourteen surfaces, grouped by how hard the UUID is to take back once it is out.

### Public HTTP endpoints — the UUID is in a URL anyone can request

| surface                                                                                       | who uses it, why                                                                                                                                                                                                                                       |
| --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /grapher/by-uuid/<uuid>.config.json` (`functions/grapher/by-uuid/[uuid].ts:17`)           | Serves that row's `full` from R2, CORS-open. Called by narrative-chart embeds (`site/multiembedder/MultiEmbedder.tsx:203`), mdim view fetches (`site/multiDim/api.ts:43`), search-result previews (`site/search/searchUtils.tsx:355`), slideshow embeds (`site/slideshows/SiteSlideChartEmbed.tsx:35`) |
| `GET /grapher/by-uuid/<uuid>.png` / `.svg` (`functions/grapher/by-uuid/[uuid].ts:22`, `:34`)   | Dynamic thumbnails. Baked into article HTML as the narrative-chart image fallback (`site/gdocs/components/NarrativeChart.tsx:75`); also used throughout the admin                                                                                        |
| `archive.ourworldindata.org/…/grapher/by-uuid/<uuid>.config.json` (`baker/archival/ArchivalBaker.ts:340-352`) | Immutable archived snapshots. The UUID is also a key in every archival manifest's asset map (`packages/@ourworldindata/types/src/domainTypes/Archive.ts:72`, `:123`, `:132`)                                                              |

### UUIDs baked into public HTML/JSON

| surface                                                                                                            | who uses it, why                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| mdim page config — `fullConfigId` per view, in the baked page and at `GET /multi-dim/<slug>.json`                   | The browser fetches the config for whichever view the reader selects (`site/multiDim/MultiDim.tsx:203`)                     |
| explorer pages — `chartConfigIdByViewId` serialized into the page (`site/ExplorerPage.tsx:95`, read back at `packages/@ourworldindata/explorer/src/ExplorerUtils.ts:31`) | Only to label analytics events (`Explorer.tsx:564-568`). Nothing renders from it                                            |
| narrative-chart gdoc attachment — `chartConfigId` (`packages/@ourworldindata/types/src/gdocTypes/Gdoc.ts:72`)       | Resolved server-side from the narrative chart's _name_ — authors never type a UUID                                          |

### Third-party analytics — leaves the system, comes back as a join key

Every grapher view event carries `viewConfigId`
(`packages/@ourworldindata/grapher/src/core/GrapherAnalytics.ts:42-49`, `:243`;
mdim `site/multiDim/hooks.ts:112`, explorer `Explorer.tsx:568`). It goes to the
external analytics system and returns into MySQL as
`analytics_chart_views.view_config_id`, which is the join key for the view counts
that drive Algolia ranking (`baker/algolia/utils/pageviews.ts:138`,
`mdimViews.ts:163`, `explorerViews.ts:659`).

### Search index

Algolia chart records carry `chartConfigId`, retrieved as a search attribute
(`packages/@ourworldindata/types/src/domainTypes/Search.ts:58`, `:146`;
`site/search/searchUtils.tsx:383`), and the site builds the preview config URL
from it. Changing it requires a reindex.

### Admin — authenticated, but still a human copying a UUID

| surface                                                                                      | who uses it, why                                                                                    |
| -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `GET /api/chart-configs/<uuid>.config.json` (`adminSiteServer/apiRouter.ts:280`)              | The "create narrative chart from an mdim view" flow (`adminSiteClient/CreateNarrativeChartEditorPage.tsx:79`) |
| `narrative-charts/create?type=multiDim&chartConfigId=<uuid>` (`site/multiDim/MultiDim.tsx:170`) | A UUID sitting in the address bar, copyable and shareable                                            |
| narrative chart index — UUID shown as a column and as a thumbnail src (`adminSiteClient/NarrativeChartIndexPage.tsx:26-31`) | Editorial browsing                                                                    |
| `adminSiteServer/mockSiteRouter.ts:226`                                                      | Mirrors the by-uuid config route for local dev and admin preview                                     |

### Data-team facing

| surface                                                                                                  | who uses it, why                                                                                             |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `chart_config_id` declared in ETL YAML ([etl#6511](https://github.com/owid/etl/pull/6511)) and the ETL chart-diff | Data engineers pin a chart to a config row from the ETL side                                                  |
| R2 layout `config/by-uuid/<id>.json` (`packages/@ourworldindata/types/src/domainTypes/Various.ts:77`), synced for all 253,786 rows by `devTools/syncGraphersToR2` | Never addressed directly by clients — always through the two endpoints above — but the key space is the UUID space |

## Consequences for the refactor

- **Only two of the four owners with a real parent need the patch persisted** —
  charts and mdim views, because indicator changes re-merge them.
  Narrative-chart patches exist purely to round-trip the editor, and nothing
  depends on them staying consistent with `full`.
- **`patch` already has two incompatible meanings** among the rows where it is
  not a duplicate: a _delta_ for charts, admin indicator rows and narrative
  charts; a _composed authored config_ for mdim views. Any single-column design
  has to name the layer, not the operation.
- **Four UUID surfaces are outside our control once written**: archive URLs
  (immutable by design), analytics history in a third-party store, Algolia
  records, and any URL a reader or colleague has copied. So a UUID may never be
  reassigned to different content.
- **Nothing user-facing ever addresses a patch.** All fourteen surfaces resolve a
  UUID to the _final_ config — an argument for `config` holding the final layer,
  with any new patch rows getting fresh UUIDs that nothing links to, so the
  public UUID space stays exactly what it is today.
