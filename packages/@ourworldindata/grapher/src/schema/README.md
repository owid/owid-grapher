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

A write also stamps `$schema` with the full revisioned url of the document it validated
against, so a stored config records which document it was last written against. Migrations
stamp the bare version instead: a config that reached 011 by mechanical rewriting was authored
against whatever came before, not against any revision of 011. So a config read off disk and
migrated carries `grapher-schema.011.json`, and the same config written back carries
`grapher-schema.011.04.json`. Rows keep a bare stamp until something rewrites them, which is
the honest answer for a config untouched since before revisions existed.

## Bumping the version

In one commit:

- Rename `grapher-schema.NNN.yaml` to `grapher-schema.MMM.yaml`, change the version in its
  `$id` and reset the revision there to `00`, and change the version in the `$schema`
  property's `pattern`. The property's `default` is a YAML alias of `$id`, and
  `yarn buildGrapherSchema` refuses to build unless the file name, the `$id` and the
  `pattern` all name the same version.
- Update the version in the docs that name it: `packageDocs/docs/chart-config/index.md` and
  `docs/chart-api.openapi.yaml`.
- Add `migrateFromNNNToMMM` to `migrations/migrations.ts` and its `"NNN"` entry in
  `MIGRATION_STEPS`; a missing entry fails typecheck. The runner restamps `$schema`, so the
  step does not. Pin each branch of the step with a before/after pair in
  `migrations/migrations.fixture.ts`.
- Write the DB migration in `db/migration/` that rewrites the stored rows and restamps
  `$schema` in `chart_configs.config` and `chart_revisions.config`, to the bare
  `grapher-schema.MMM.json`. Ship the restamp and the rewrite together.
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
  every published edit also lands under the revisioned name its `$id` declares, which is the
  name the ETL pins in `DEFAULT_GRAPHER_SCHEMA`.
- Once this repo has deployed, merge the sibling ETL PR. Never before, since the ETL pushes
  configs stamped with that version.

## Editing without bumping

Every edit that changes the built JSON — a new field, a widened enum, a reworded description —
must move the revision in `$id`. Consumers pin that name and expect the document behind it not
to change, so `grapher-schema.yml` fails a branch whose schema differs from the published
document under a revision that is already published. The revision is two digits, it is an
ordinal rather than a fraction, and it resets to `00` at a bump.

The check compares against the published `grapher-schema.NNN.json`, which is what master last
published rather than what this branch forked from — so it also catches a branch that is
behind. It cannot check anything while the published document names no revision, and a fetch
that fails leaves the revision unchecked rather than blocking the branch.

The revision says which document a config was written against, not what that config contains.
A config stamped `011.04` was last written while `011.04` was current; it says nothing about
which fields the config uses. So a reader must not turn `config.revision > build.revision` into
a warning — that comparison is a timestamp in disguise, and it fires on almost every config an
even slightly old build sees.

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
`<dir>` under both the mutable name and the revisioned name its `$id` declares, and `--latest`
adds a `.latest` alias there. All three are byte-identical. The R2 workflow syncs that
directory up to the bucket.

```bash
yarn buildGrapherSchema
```

## File names

`grapher-schema.<version>.json` is the mutable name; publishing overwrites it in place.
`grapher-schema.<version>.<revision>.json` is what consumers pin, so it has to stay the
document it was when they pinned it; moving the revision on every edit is what keeps that
true, and CI checks it on branches. `grapher-schema.latest.json` aliases the mutable name of whichever
version is newest. `<version>` is zero-padded to three digits, `<revision>` to two.
