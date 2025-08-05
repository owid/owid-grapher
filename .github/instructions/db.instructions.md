---
applyTo: "db/**/*.ts"
---

The db folder contains the database access code for the OWID admin. The database used is MySQL 8.

The migration subfolder contains the pre-migrations-schema.sql file that describes the original Mysql database schema ca 2018. Building on this state, the various \*.ts files describe the migrations since then (the filenames are prefixed by unix timestamp so can be listed alphabetically to see the correct order). To create new migrations, run the `yarn createDbMigration db/migration/<NewMigrationName>` which will create a new migration file. Choose a descriptive name for the migration. The generated filename will contain a timestamp, so you have to scan the directory to know the actual path of the new file.

The model folder contains helper functions to query most tables (not all tables are used by the Grapher admin - some are used by auxiliary systems). The most complex models are those related to our GDocs based CMS, represented in the posts_gdocs table. The related model classes are in the model/GDoc subfolder and contain substantial business logic and a class hierarchy.

The tests folder contains database tests. These can be run via `make dbtest` which spins up a test mysql database, runs the migrations and then runs the database tests.
