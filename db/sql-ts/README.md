## Generating types from the MySQL schema

This folder contains the two helper files to use SQL-TS with our database. SQL-TS is a project that generates typescript types from a mysql database. This was useful in late 2023 to create parity between the tables we have currently in MySQL and the type definitions we have in our codebase.

The outcome of running this tool is the file `db/sql-ts/Database.ts` that contains one typescript interface for each table in the schema. The configuration lives in `db/sql-ts/sql-ts-config.json`, the handlebars template file that is filled with the type info lives in `db/sql-ts/template.handlebars`.

## Running the tool

To run the tool, check the config in `db/sql-ts/sql-ts-config.json` and then run `yarn generateDbTypes` in the root folder.
