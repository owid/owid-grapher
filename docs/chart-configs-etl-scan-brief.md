# Brief: scan the ETL for `chart_configs` reads that need fixing

_A task brief for an agent working in the **owid/etl** repo. It is the ETL-side
counterpart of a scan already completed in owid-grapher. Written by an agent that
has **never seen the ETL repo** — every `etl/...` path below came second-hand and
must be verified, not trusted._

Companion docs in owid-grapher: [target schema](./chart-configs-target-schema.md),
[migration plan](./chart-configs-migration.md),
[current layering model](./chart-configs-current-model.md).

## Background

`chart_configs` in the grapher MySQL DB currently stores every grapher config
twice: `patch` (the authored delta) and `full` (the merged result). A refactor
replaces both with a single `config` column, and moves the authored layer into
**separate rows** pointed at by new FK columns.

Schema change, in full:

| today | after |
| ----- | ----- |
| `chart_configs.full` | `chart_configs.config` |
| `chart_configs.patch` | **gone** — the authored layer is a separate `chart_configs` row |
| `chart_configs.fullMd5` | `chart_configs.configMd5` |
| `chart_configs.slug`, `.chartType` | unchanged names, now generated over `config` |
| — | `charts.patchConfigId` (new, `NOT NULL UNIQUE`) |
| — | `multi_dim_x_chart_configs.patchConfigId` (new) |
| — | `narrative_charts.patchConfigId` (new) |
| `variables.grapherConfigIdETL` | `variables.patchConfigIdETL` |
| `variables.grapherConfigIdAdmin` | `variables.patchConfigIdAdmin` |
| `multi_dim_x_chart_configs.chartConfigId` | `multi_dim_x_chart_configs.configId` |
| `narrative_charts.chartConfigId` | `narrative_charts.configId` |
| `explorer_views.chartConfigId` | `explorer_views.configId` |

Row count goes from 253,786 to ~261,199: 7,275 orphans deleted, **14,688 new
patch rows added**. Those new rows are the source of every risk below.

The invariant to internalise:

> **A `chart_configs` row is a config. The FK that names it says which kind:
> `…ConfigId` names the config that renders; `patchConfigId*` names an authored
> layer. Always reach a config through its owner.**

## Two separable deliverables

Keep these apart — they ship at different times.

**(A) Fixes that are correct *today*.** Any query that reads `chart_configs`
without joining an owner table is already wrong or fragile, independent of the
refactor. These can ship immediately as their own PR. In grapher this pass found a
**live bug** that had been silently mis-reporting data (see "The trick" below).

**(B) The migration inventory.** Every site that must change when the columns are
renamed. This becomes the ETL PR that ships right after the grapher migration.
Do not apply these changes yet — the columns still have their old names.

## The risk classes

1. **Reads of `chart_configs` with no owner join.** 14,688 patch rows will start
   matching. Symptoms: duplicated rows, inflated counts, rows with `slug = NULL`.
2. **By-slug lookups against `chart_configs`.** A published chart's patch row
   carries **both** `slug` and `isPublished` (both are force-kept when the patch is
   computed), so all 4,444 published charts will match twice. `idx_chart_configs_slug`
   is non-unique, so MySQL will not complain.
3. **Reads of `patch`.** The column disappears. Its value moves to the row named by
   the owner's `patchConfigId`.
4. **Reads of `full` / `fullMd5`.** Renamed to `config` / `configMd5`.
5. **Reads of the renamed FK columns** (table above).
6. **Config JSON living outside `chart_configs`.** In grapher this class was missed
   on the first pass — `chart_revisions.config` turned out to hold grapher config
   JSON (and its own table docs described it wrongly). Check for the ETL's
   equivalents.

Note that mdim view configs carry `isPublished` copied from their page and have
`slug = NULL`. That combination is what made grapher's live bug invisible: a query
filtering only on `isPublished` picked up 355 mdim views and attributed them to a
null slug.

## The trick that finds live bugs

For each candidate query, **add the owner join and compare results against the
current version on real data**:

- **Identical results** → the query was already safe; the join is hardening for the
  migration. Note it and move on.
- **Different results** → you have found a bug that exists *today*. It goes in
  deliverable (A).

This is exactly how grapher's live bug surfaced: `2,295` rows before the join,
`1,940` after. Run both forms; don't reason about it.

## Search recipe

Run all of these. The first pass in grapher used only the first two and **missed
real sites**, so treat the later ones as mandatory, not optional.

1. `rg 'chart_configs'` across the repo — the literal table name.
2. `rg 'ChartConfig'` — the ORM class / any table-name constant. **This is the step
   that is easy to skip and it found ~29 additional sites in grapher**, because
   query-builder calls never contain the literal table name.
3. Repeat 1–2 for **every file type**, not just `.py`: `.sql`, `.ipynb`, `.md`,
   `.yml`, `.sh`, `.js`, and any templated SQL. In grapher, restricting to the main
   language was itself a gap.
4. `rg 'patch|full|fullMd5'` scoped to files that touch chart configs — catches
   column reads that never name the table.
5. Grep for the FK column names being renamed: `grapherConfigIdETL`,
   `grapherConfigIdAdmin`, `chartConfigId`.
6. **Dynamically constructed table names** — any code that iterates a list of
   tables or interpolates a table name into SQL.
7. **Config JSON columns elsewhere.** Query the DB itself rather than grepping:
   ```sql
   SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE
   FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND (DATA_TYPE = 'json' OR COLUMN_NAME LIKE '%onfig%')
   ORDER BY TABLE_NAME, COLUMN_NAME;
   ```
   Then check which of those the ETL reads.
8. **DB-side objects**: views, triggers, stored routines, scheduled events. Grapher
   has three views over `chart_configs` and no triggers/routines/events — verify
   whether the ETL created any of its own:
   ```sql
   SELECT TABLE_NAME FROM information_schema.VIEWS WHERE TABLE_SCHEMA = DATABASE();
   SELECT TRIGGER_NAME, EVENT_OBJECT_TABLE FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = DATABASE();
   SELECT ROUTINE_NAME FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = DATABASE();
   ```
9. Don't forget agent skills / notebooks / ad-hoc analysis scripts that query the
   grapher DB.

## Starting points (second-hand — verify each)

These were reported by a human, not confirmed by me. Treat the list as a seed, not
a scope.

| site | what it reportedly does |
| ---- | ----------------------- |
| `etl/analytics/data.py:375` | `JOIN chart_configs cc ON pgl.target = cc.slug` — **the one known live bug**; needs a join through `charts` |
| `etl/grapher/io.py:721`, `:791` | reads `chart_configs` via SQL |
| `etl/grapher/model.py:330` | `ChartConfig` read-side ORM mapping (`config`/`configMd5`); nothing constructs or `session.add`s one |
| `etl/grapher/model.py:2056` | reads `chart_configs` via SQL |
| `etl/indicator_upgrade/indicator_update.py` | reads the **chart patch** — a class-3 site |
| `NarrativeChart.load_patch_config` | reads the **narrative-chart patch** — a class-3 site |
| `apps/wizard/app_pages/chart_diff/chart_diff.py` | chart-diff; check what it hashes/compares |
| `etl/grapher/to_db.py:515` | `DELETE FROM multi_dim_x_chart_configs WHERE variableId IN (…)` — a **write**, see below |

Useful established facts:

- The ETL is **read-only** against `chart_configs`. All config writes go over HTTP
  through `apps/chart_sync/admin_api.py`, so grapher owns materializing and hashing.
  **Confirm this still holds** — the whole migration's safety argument depends on it.
- `etl/grapher/to_db.py:515` is the one relevant write, and it doesn't touch
  `chart_configs`. But after the refactor, deleting a `multi_dim_x_chart_configs`
  row strands **two** config rows instead of one. Grapher is adding a periodic
  orphan sweep to handle this; no ETL change needed. Just don't "fix" it by having
  the ETL delete grapher's config rows.

## Deliverable

A report with one row per site, triaged the same way:

| verdict | meaning |
| ------- | ------- |
| **FIX NOW** | wrong today; goes in deliverable (A) with before/after row counts proving it |
| **HARDEN** | correct today, unsafe after the migration; can ship with (A) |
| **MIGRATE** | needs a column/pointer rename; goes in deliverable (B) |
| **SAFE** | reached by id, or already owner-joined — state which |

Also report:

- Anything you could **not** reach (external consumers, dashboards, notebooks
  outside the repo), stated plainly rather than omitted.
- Whether the read-only assumption held.
- Any config JSON column outside `chart_configs` that the ETL reads.

## Non-goals

- Do not change anything in owid-grapher.
- Do not apply the column renames yet — the migration has not run.
- Do not attempt the patch/full → config migration itself; that is grapher's PR.
- Do not derive patches by diffing a config against its parent as a workaround. It
  silently loses keys an author deliberately pinned whose value happens to match the
  parent, which is the whole reason patches are stored.

## One caution

In grapher, **every additional search method found something the previous ones had
missed** — a different file extension, a query-builder constant, a JSON column in
another table. Do not report "everything else is safe" on the strength of one grep.
State the methods you ran, so the coverage claim can be audited against them.
