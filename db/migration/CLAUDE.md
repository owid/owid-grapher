## Checklist for when there are changes to the database

When a new migration is added, make sure that:

- If columns have been added/deleted, all necessary views were recreated that reference one of the modified columns
- The DB type definitions in the /packages/@ourworldindata/types/src/dbTypes folder have been updated
- The docs in ../docs/ have been updated
- **The impact on the public data export has been reviewed** (see [below](#public-data-export-datasette--publicduckdb)) — adding, dropping, or renaming a table or column can leak private data into, or break, the public `public.duckdb` published on Datasette

Additionally, make sure you tell the user that it may be necessary to adjust the code in:

- the owid/etl repository and
- the owid/analytics repository

### Public data export (Datasette / `public.duckdb`)

A sanitized, **published-content-only** copy of this database is exported nightly to the public as `public.duckdb` (browsable on [datasette-public.owid.io](https://datasette-public.owid.io) and available as an open download). What it exposes is an **explicit allowlist** defined in the **`owid/analytics`** repo (`analytics/duckdb/build.py` plus the reviewed snapshot `analytics/duckdb/public_schema.json`). The nightly analytics bake fails if the built schema drifts from that allowlist, so an unreviewed schema change will break the pipeline (e.g. [build #793](https://buildkite.com/our-world-in-data/analytics-full-bake-daily/builds/793): `SCHEMA DRIFT ... REMOVED COLUMN redirects.{code}`).

We have previously leaked data we did not intend to publish, so treat this as a **required review step** whenever a migration adds, drops, or renames a table or column:

- **New table or column** → decide whether it is safe to publish. **When in doubt, keep it out.** Never publish drafts / unpublished content, PII (emails, tokens), editor/reviewer ids, internal flags, or free-text editorial notes. Only field-level metadata that is already visible on published pages of ourworldindata.org should go public.
- **Dropped or renamed column that was public** → this is a breaking change for downstream consumers of `public.duckdb` and must be announced.

To action either case, run the **`fix-public-export-drift` skill** (in the `owid/analytics` repo). It walks through excluding a field or blessing it into the allowlist and regenerating `public_schema.json` — the committed diff to that file is the review record for widening the public surface.

**If you are unsure whether a field is safe to publish, ask the analytics team (`#data-analytics` on Slack) before merging — do not publish by default.**
