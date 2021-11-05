This folder contains the JSON schema for the configuration of Grapher. Most of the fields can be left empty and will be filled with reasonable default values. Inside OWID we use the admin interface to construct these configs with a UI, but other projects might want to create them programmatically.

## How do evolve the schema

The schema is versioned. Nonbreaking changes (e.g. additions of optional fields) can be added to the existing schema as is. It is preferred
to edit the yaml file and then generate the json from yaml (using an editor plugin or similar).

Breaking changes should be done by copying the schema file and increasing the version number, then publishing this next to the old
schema version. Then write the migrations from the last to the current version of the schema, including the migration of pointing
to the URL of the new schema version.

## Regenerating the docs

The docs were created with [Json schema for humans](https://github.com/coveooss/json-schema-for-humans).

## Schema TODO

[ ] - Put first schema version in publicly accessible http space
[ ] - Add link to this schema url to all existing charts (this also deals with versioning)
[ ] - How should we do schema migrations. Node scripts? Python scripts?
[ ] - Once we have schema migrations we can remove the last remaining obsolete properties
[ ] - Should we flatten the array of dimensions into an object and only y can be an array?
[ ] - Add python script to generate schema.json from schema.yaml and to generate the docs
