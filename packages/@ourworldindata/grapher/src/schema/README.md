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
- Add `migrateFromNNNToMMM` to `migrations/migrations.ts` and add a case for `NNN` to the
  match in `runMigration`. The match is exhaustive, so a missing case fails typecheck.
- Write the DB migration in `db/migration/` that rewrites the stored rows and restamps
  `$schema` in `chart_configs.config` and `chart_revisions.config`. Ship the restamp and the
  rewrite together.
- Regenerate `defaultGrapherConfig.ts`, see below.

Before merging:

- Prepare a sibling PR in the etl repo, following the version-bump section of its
  `/sync-grapher-schema` skill. It moves `DEFAULT_GRAPHER_SCHEMA` in `etl/config.py`, updates
  the `$ref`s in the ETL's own schemas and re-vendors the schema.

After merging:

- `sync-grapher-schema-to-r2.yml` uploads this folder to the `schemas` prefix of the
  `owid-public` bucket on Cloudflare R2, as JSON and YAML plus a `.latest` alias of each.
  `files.ourworldindata.org/schemas/` serves that bucket. The sync never deletes, so every
  version ever published keeps resolving.
- Once this repo has deployed, merge the sibling ETL PR. Never before, since the ETL pushes
  configs stamped with that version.

## Regenerating the default config

Regenerate `defaultGrapherConfig.ts` whenever the schema changes. Replace `XXX` with the
current schema version number and run:

```bash
# generate json from the yaml schema
nu -c 'open packages/@ourworldindata/grapher/src/schema/grapher-schema.XXX.yaml | to json' > packages/@ourworldindata/grapher/src/schema/grapher-schema.XXX.json

# generate the default object from the schema
yarn tsx --tsconfig tsconfig.tsx.json devTools/schema/generate-default-object-from-schema.ts packages/@ourworldindata/grapher/src/schema/grapher-schema.XXX.json --save-ts packages/@ourworldindata/grapher/src/schema/defaultGrapherConfig.ts
```
