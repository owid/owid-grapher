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

- Rename `grapher-schema.NNN.yaml` to `grapher-schema.MMM.yaml` and change the URL in its
  `$id`. The `default` and `const` of the `$schema` property are YAML aliases of it, and
  `yarn buildGrapherSchema` refuses to build when the `$id` and the file name disagree on
  the version.
- Update the version in the docs that name it: `packageDocs/docs/chart-config/index.md` and
  `docs/chart-api.openapi.yaml`.
- Add `migrateFromNNNToMMM` to `migrations/migrations.ts` and its `"NNN"` entry in
  `MIGRATION_STEPS`; a missing entry fails typecheck. The runner restamps `$schema`, so the
  step does not. Pin each branch of the step with a before/after pair in
  `migrations/migrations.fixture.ts`.
- Write the DB migration in `db/migration/` that rewrites the stored rows and restamps
  `$schema` in `chart_configs.config` and `chart_revisions.config`. Ship the restamp and the
  rewrite together.
- Run `yarn buildGrapherSchema`, see below.

Before merging:

- Prepare a sibling PR in the etl repo, following the version-bump section of its
  `/sync-grapher-schema` skill. It moves `DEFAULT_GRAPHER_SCHEMA` in `etl/config.py`, updates
  the `$ref`s in the ETL's own schemas and re-vendors the schema.

After merging:

- `sync-grapher-schema-to-r2.yml` uploads the JSON to the `schemas` prefix of the
  `owid-public` bucket on Cloudflare R2, with a `.latest` alias.
  `files.ourworldindata.org/schemas/` serves that bucket. The sync never deletes, so every
  version ever published keeps resolving. Besides the mutable name and the `.latest` alias,
  every published edit also lands under an immutable, revisioned name. The workflow assigns
  that revision by comparing the document it just built against the highest revision already
  in the bucket: unchanged keeps the existing revision, changed mints the next one. This is
  the name the ETL pins in `DEFAULT_GRAPHER_SCHEMA`.
- Once this repo has deployed, merge the sibling ETL PR. Never before, since the ETL pushes
  configs stamped with that version.

## Writing a migration step

- Only read the key you're migrating. Other keys may come from different config layers.
- Don't use defaults for missing keys. Missing means inherit from a parent.
- Don't remove a key just because it matches the default. It may override a parent.
- Handle every possible value of the old key, not just the interesting ones.
- Be careful when changing shapes. Objects deep-merge, while arrays replace the whole value, so shape changes can change inheritance behavior.
- Test each migration with a before/after pair and a two-layer stack where parent and child conflict.

## Regenerating the generated files

`yarn buildGrapherSchema` reads the newest `grapher-schema.NNN.yaml` and writes
`defaultGrapherConfig.ts` next to it. That file is committed. Run it whenever the schema
changes. CI runs it on every push that touches this folder and commits the result.

The JSON form of the schema is not committed anywhere. `--publish-dir <dir>` writes it to
`<dir>`, and `--latest` adds a `.latest` alias there. `--published-dir <dir>` names a local
directory mirroring what the bucket already holds; when given, the script also decides and
writes the revisioned file into `--publish-dir`. The R2 workflow fills `--published-dir` with
`aws s3 sync` before calling this script, and syncs `--publish-dir` up to the bucket
afterwards.

```bash
yarn buildGrapherSchema
```

## File names

`grapher-schema.<version>.json` is the mutable name; publishing overwrites it in place.
`grapher-schema.<version>.<revision>.json` is immutable; once published it is never
overwritten. `grapher-schema.latest.json` aliases the mutable name of whichever version is
newest. `<version>` is zero-padded to three digits, `<revision>` to two.
