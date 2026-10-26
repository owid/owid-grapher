This folder contains the JSON schema for the configuration of Grapher.

## What `$schema` means

The schema is versioned, and every config records its version in `$schema`. A config's `$schema` holds a schema name, such as `grapher-schema.011.04.json`. The name has two parts:

- The version (`011`) says which migrations a config still needs. A config whose `$schema` names `NNN` goes through the migrations from `NNN` to the latest version before a current build reads it.
- The revision (`04`) records which schema document the config was written against.

Configs written before revisions existed carry only the version, as in `grapher-schema.011.json`. The schema accepts both forms.

Writes migrate a config to the latest version, validate it, and reject it if it's invalid. Reads only migrate and never validate, because every stored config passed validation on the way in.

## Which number to bump

**Bump the version only if stored configs must be rewritten for the new code to render them as before** (e.g. `011.04` → `012.00`).

- For example, removing or renaming a field, or narrowing an enum.
- When changing a default value:
    - Bump if existing charts should stay as they are. A migration then writes the old default into existing configs.
    - Don't bump if every chart should pick up the new default.
- The revision resets to `00`.

**Bump the revision for every other change** (e.g. `011.04` → `011.05`).

- For example, adding an optional field, widening an enum, or rewording a description.
- No migration is needed.

## Bumping the version

Every version bump needs two migrations:

- a DB migration that rewrites the stored configs
- a step in `migrations/migrations.ts` that rewrites configs as they enter the code

In one commit:

- Rename `grapher-schema.NNN.yaml` to `grapher-schema.MMM.yaml`, change the version in its `$id` and reset the revision there to `00`, and change the version in the `$schema` property's `pattern`. The property's `default` is a YAML alias of `$id`, and `yarn buildGrapherSchema` refuses to build unless the file name, the `$id` and the `pattern` all name the same version.
- Add `migrateFromNNNToMMM` to `migrations/migrations.ts` and its `"NNN"` entry in `MIGRATION_STEPS`; a missing entry fails typecheck. Pin each branch of the step with a before/after pair in `migrations/migrations.fixture.ts`.
- Write the DB migration in `db/migration/` that rewrites the stored rows in `chart_configs.config` and `chart_revisions.config` and sets their `$schema` to the literal `grapher-schema.MMM.00.json`.
- Run `yarn buildGrapherSchema` to regenerate `defaultGrapherConfig.ts` from the renamed YAML.

Before merging:

- Prepare a sibling PR in the etl repo, following the version-bump section of its `/sync-grapher-schema` skill. It moves `DEFAULT_GRAPHER_SCHEMA` in `etl/config.py`, updates the `$ref`s in the ETL's own schemas and re-vendors the schema.

After merging:

- `sync-grapher-schema-to-r2.yml` uploads the JSON to the `schemas` prefix of the `owid-public` bucket on Cloudflare R2, with a `.latest` alias. `files.ourworldindata.org/schemas/` serves that bucket. The sync never deletes, so every version ever published keeps resolving. Besides the mutable name and the `.latest` alias, every published edit also lands under the revisioned name its `$id` declares.
- Once this repo has deployed, merge the sibling ETL PR. Never before, since the ETL pushes configs that declare that version.

## Bumping the revision

Move the revision in `$id`. CI fails a branch that changes the schema without moving it.

## Writing a migration step

- Only read the key you're migrating. Other keys may come from different config layers.
- Don't use defaults for missing keys. Missing means inherit from a parent.
- Don't remove a key just because it matches the default. It may override a parent.
- Handle every possible value of the old key, not just the interesting ones.
- Changing a value's shape changes how it inherits. Objects deep-merge, while arrays replace the whole value.
- Test each migration with a before/after pair and a two-layer stack where parent and child conflict.

## Regenerating the generated files

`yarn buildGrapherSchema` reads the newest `grapher-schema.NNN.yaml` and writes `defaultGrapherConfig.ts` next to it. That file is committed. Run it whenever the schema changes. CI runs it on every push that touches this folder and commits the result.

The JSON form of the schema is not committed anywhere. `--publish-dir <dir>` writes it to `<dir>` under both the mutable name and the revisioned name its `$id` declares, and `--latest` adds a `.latest` alias there. All three are byte-identical. The R2 workflow syncs that directory up to the bucket.

```bash
yarn buildGrapherSchema
```

## File names

`grapher-schema.<version>.json` is the mutable name; publishing overwrites it in place. `grapher-schema.<version>.<revision>.json` is immutable. Moving the revision on every edit is what keeps that true, and CI checks it on branches. `grapher-schema.latest.json` aliases the mutable name of whichever version is newest. `<version>` is zero-padded to three digits, `<revision>` to two.
