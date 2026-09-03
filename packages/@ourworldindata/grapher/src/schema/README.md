This folder contains the JSON schema for the configuration of Grapher.

## What `$schema` means

The schema is versioned, and every config records its version in `$schema`. That version tells
the code which migrations the config still has to run. A config stamped N goes through the
migrations from N to the latest version before a current build reads it.

Bump the version if, and only if, stored configs have to be rewritten for the new code to
render them as before. Removing a field, renaming one or narrowing an enum needs a bump. So
does changing a default when existing charts should not change. Every other edit lands in the
current version, with no rename and no migration. Adding an optional field or widening an enum
is an edit, not a bump, and so is changing a default when every chart should pick it up.

Every bump ships the same rewrite twice. The database migration rewrites the stored rows. The
migration in `migrations/migrations.ts` rewrites a config at the boundary, as it enters the code.

A write must migrate the config to the latest version and reject it if it fails validation. A
read only migrates, never validates. Reads can skip validation because every stored config
passed it on the way in.

## Bumping the version

In one commit:

- Rename `grapher-schema.NNN.yaml` to `grapher-schema.MMM.yaml` and change the URL inside it
  in all three places: the `$id` and the `default` and `const` of the `$schema` property.
- Update the version in the docs that name it: `packageDocs/docs/chart-config/index.md` and
  `docs/chart-api.openapi.yaml`.
- Add `migrateFromNNNToMMM` to `migrations/migrations.ts` and its `"NNN"` entry in
  `MIGRATION_STEPS`. A missing entry fails typecheck.
- Write the DB migration in `db/migration/` that rewrites the stored rows and restamps
  `$schema` in `chart_configs.config` and `chart_revisions.config`. Ship the restamp and the
  rewrite together.
- Run `yarn buildGrapherSchema`, see below.

Before merging:

- Prepare a sibling PR in the etl repo, following the version-bump section of its
  `/sync-grapher-schema` skill. It moves `DEFAULT_GRAPHER_SCHEMA` in `etl/config.py`, updates
  the `$ref`s in the ETL's own schemas and re-vendors the schema.
- Every push to a branch that touches this folder uploads the full JSON and the layer JSON
  to `schemas/preview/<branch>/` on R2, without `.latest` aliases. The sibling ETL PR can pin
  the new version against
  `files.ourworldindata.org/schemas/preview/<branch>/grapher-schema.MMM.json` before this repo
  publishes it.

After merging:

- The push to master runs `sync-grapher-schema-to-r2.yml`, which uploads the full JSON and the
  layer JSON to the `schemas` prefix of the `owid-public` bucket on Cloudflare R2, each with a
  `.latest` alias. The layer document is the same schema with `required` reduced to `$schema`,
  for configs that are merged into a chart rather than rendered on their own.
  `files.ourworldindata.org/schemas/` serves that bucket. The sync never deletes, so every
  version ever published keeps resolving.
- Once this repo has deployed, merge the sibling ETL PR. Never before, since the ETL pushes
  configs stamped with that version.

## Regenerating the generated files

`yarn buildGrapherSchema` reads the newest `grapher-schema.NNN.yaml` and writes
`grapher-schema.NNN.json`, `grapher-schema.NNN.layer.json` and `defaultGrapherConfig.ts` next to
it. Run it whenever the schema changes. CI runs it on every push that touches this folder.
With `--out-dir <dir>` the two JSON files go to `<dir>` instead, and `--latest` adds a
`.latest` alias of each; the R2 upload uses both.

```bash
yarn buildGrapherSchema
```
