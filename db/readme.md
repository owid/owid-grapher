# Database

This folder contains the code for interacting with our MySQL database. We store wordpress content, charts, data, and more in MySQL.

## Setup

See the root [README](../README.md).

## Migrations

If you need to make changes to the MySQL database structure, these are specified by [typeorm](https://typeorm.io/#/migrations) migration files.

### Running all migrations

Run:

```sh
yarn runDbMigrations
```

This **runs automatically in the server deploy script**, so you only need to run it manually when:

-   You are creating a new migration locally, or
-   Someone else has created a migration

The database dumps we provide has all migrations already applied.

### Creating a migration

Run:

```sh
yarn typeorm migration:create -n MigrationName
```

And then populate the file with the SQL statements to alter the tables, using [past migration files](./migration) for reference if needed. Don't forget to rebuild the javascript artifacts now from typescript view `yarn buildTsc`, then run migrations with `yarn runDbMigrations`.

Make sure you write a **down** migration in case there is any chance things can go wrong we'd need to revert it.

You can find examples of older migrations here: https://github.com/owid/owid-grapher/tree/2dd7f0661ba6fe7fdfb1ad2a59b9ef7ed7a2ad9f/db/migration

### Reverting a migration

To revert the last migration on **your local development server**, use `yarn typeorm migration:revert`. Running that repeatedly will revert additional migrations. This is useful when working with migrations locally – when you make a change to an existing migration, you need to revert and re-run it.

If the migration **has been run in production**, create a new migration that is a duplicate of the one you want to revert, and then swap the `up` and `down` functions.

Also, you can always refresh **non-production** databases from the database dumps.
