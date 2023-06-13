This folder contains the JSON schema for the configuration of Grapher.

## How to evolve the schema

The schema is versioned. There is one yaml file with a version number. For nonbreaking changes (e.g. additions of optional fields) you can just
edit the yaml file as is. A github action will then generate a .latest.yaml and two json files (one .latest.json and one with the version number.json)
and upload them to S3 so they can be accessed publicly.

Breaking changes should be done by renaming the schema file to an increased version number. Make sure to also rename the authorative url
iside the schema file (the "$id" field at the top level) to point to the new version number json. Then write the migrations from the last to
the current version of the schema, including the migration of pointing to the URL of the new schema version.
