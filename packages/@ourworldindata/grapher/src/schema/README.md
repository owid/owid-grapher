This folder contains the JSON schema for the configuration of Grapher.

## What `$schema` means

`$schema` is a url naming two numbers. `grapher-schema.011.04.json` is version `011`, revision
`04`. The version tells the code which migrations the config still has to run, so a config
stamped NNN goes through the migrations from NNN to the latest version before a current build
reads it. The revision records which document the config was last written against. A stored
config always carries one, and no code branches on it: comparing a config's revision against the
build's says when the config was written, not which fields it uses.

A write must migrate the config to the latest version and reject it if it fails validation. A
read only migrates, never validates. Reads can skip validation because every stored config
passed it on the way in.

## Which number to bump

Bump the version if, and only if, stored configs have to be rewritten for the new code to
render them as before: removing a field, renaming one, narrowing an enum, or changing a default
when existing charts should not change. That needs a migration step and a DB rewrite, and it
resets the revision to `00`.

Bump the revision for every other change to the built JSON: a new optional field, a widened
enum, a reworded description, or a changed default every chart should pick up. No migration
necessary.

## Bumping the version

You write every version bump twice. A database migration rewrites the stored rows, and a step
in `migrations/migrations.ts` rewrites each config as it enters the code.

In one commit:

- Rename `grapher-schema.NNN.yaml` to `grapher-schema.MMM.yaml`, change the version in its
  `$id` and reset the revision there to `00`, and change the version in the `$schema`
  property's `pattern`. The property's `default` is a YAML alias of `$id`, and
  `yarn buildGrapherSchema` refuses to build unless the file name, the `$id` and the
  `pattern` all name the same version.
- Add `migrateFromNNNToMMM` to `migrations/migrations.ts` and its `"NNN"` entry in
  `MIGRATION_STEPS`; a missing entry fails typecheck. Pin each branch of the step with a
  before/after pair in `migrations/migrations.fixture.ts`.
- Write the DB migration in `db/migration/` that rewrites the stored rows and restamps
  `$schema` in `chart_configs.config` and `chart_revisions.config`, to the literal
  `grapher-schema.MMM.00.json`.
- Run `yarn buildGrapherSchema` to regenerate `defaultGrapherConfig.ts` from the renamed YAML.

Before merging:

- Prepare a sibling PR in the etl repo, following the version-bump section of its
  `/sync-grapher-schema` skill. It moves `DEFAULT_GRAPHER_SCHEMA` in `etl/config.py`, updates
  the `$ref`s in the ETL's own schemas and re-vendors the schema.

After merging:

- `sync-grapher-schema-to-r2.yml` uploads the JSON to the `schemas` prefix of the
  `owid-public` bucket on Cloudflare R2, with a `.latest` alias.
  `files.ourworldindata.org/schemas/` serves that bucket. The sync never deletes, so every
  version ever published keeps resolving. Besides the mutable name and the `.latest` alias,
  every published edit also lands under the revisioned name its `$id` declares.
- Once this repo has deployed, merge the sibling ETL PR. Never before, since the ETL pushes
  configs stamped with that version.

## Bumping the revision

Move the revision in `$id`, and nothing else. CI fails a branch that changes the schema without
moving it.

## Writing a migration step

- Only read the key you're migrating. Other keys may come from different config layers.
- Don't use defaults for missing keys. Missing means inherit from a parent.
- Don't remove a key just because it matches the default. It may override a parent.
- Handle every possible value of the old key, not just the interesting ones.
- Changing a value's shape changes how it inherits. Objects deep-merge, while arrays replace
  the whole value.
- Test each migration with a before/after pair and a two-layer stack where parent and child
  conflict.

## Regenerating the generated files

`yarn buildGrapherSchema` reads the newest `grapher-schema.NNN.yaml` and writes
`defaultGrapherConfig.ts` next to it. That file is committed. Run it whenever the schema
changes. CI runs it on every push that touches this folder and commits the result.

The JSON form of the schema is not committed anywhere. `--publish-dir <dir>` writes it to
`<dir>` under both the mutable name and the revisioned name its `$id` declares, and `--latest`
adds a `.latest` alias there. All three are byte-identical. The R2 workflow syncs that
directory up to the bucket.

```bash
yarn buildGrapherSchema
```

## File names

`grapher-schema.<version>.json` is the mutable name; publishing overwrites it in place.
`grapher-schema.<version>.<revision>.json` is what consumers pin, so it has to stay the
document it was when they pinned it. Moving the revision on every edit is what keeps that true,
and CI checks it on branches. `grapher-schema.latest.json` aliases the mutable name of
whichever version is newest. `<version>` is zero-padded to three digits, `<revision>` to two.
