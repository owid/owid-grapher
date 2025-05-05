This folder contains the JSON schema for the configuration of Grapher.

## How to evolve the schema

The schema is versioned. There is one yaml file with a version number. For nonbreaking changes (e.g. additions of optional fields) you can just
edit the yaml file as is. A github action will then generate a .latest.yaml and two json files (one .latest.json and one with the version number.json)
and upload them to S3 so they can be accessed publicly.

If you update the default value of an existing property or you add a new property with a default value, make sure to regenerate the default object from the schema and save it to `defaultGrapherConfig.ts` (see below).

Breaking changes should be done by renaming the schema file to an increased version number. Make sure to also rename the authorative url
inside the schema file (the "$id" field at the top level) to point to the new version number json. Then write the migrations from the last to
the current version of the schema, including the migration of pointing to the URL of the new schema version.s

Checklist for breaking changes:

- Rename the schema file to an increased version number
- Rename the authorative url inside the schema file to point to the new version number json
- Write the migrations from the last to the current version of the schema, including the migration of pointing to the URL of the new schema version
- Regenerate the default object from the schema and save it to `defaultGrapherConfig.ts` (see below)
- Write a migration to update the `chart_configs.full` column in the database for all stand-alone charts
- Write a migration to update configs in code (see `migrations/migrations.ts`)
- Update the hardcoded default schema version in ETL

To regenerate `defaultGrapherConfig.ts` from the schema, replace `XXX` with the current schema version number and run:

```bash
# generate json from the yaml schema
nu -c 'open packages/@ourworldindata/grapher/src/schema/grapher-schema.XXX.yaml | to json' > packages/@ourworldindata/grapher/src/schema/grapher-schema.XXX.json

# generate the default object from the schema
yarn tsx --tsconfig tsconfig.tsx.json devTools/schema/generate-default-object-from-schema.ts packages/@ourworldindata/grapher/src/schema/grapher-schema.XXX.json --save-ts packages/@ourworldindata/grapher/src/schema/defaultGrapherConfig.ts
```
