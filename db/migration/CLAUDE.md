## Checklist for when there are changes to the database

When a new migration is added, make sure that:

- If columns have been added/deleted, all necessary views were recreated that reference one of the modified columns
- The DB type definitions in the /packages/@ourworldindata/types/src/dbTypes folder have been updated
- The docs in ../docs/ have been updated

Additionally, make sure you tell the user to make sure that it may be necessary to adjust the code in:

- the owid/etl repository and
- the owid/analytics repository
