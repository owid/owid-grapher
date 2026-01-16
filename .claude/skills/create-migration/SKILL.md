---
name: create-migration
description: Create a new database migration file for the OWID MySQL database. Use when the user needs to create a database schema change or migration.
---

# Create Database Migration

Create a new database migration file for the OWID MySQL 8 database.

## Steps

1. Run `yarn createDbMigration db/migration/<NewMigrationName>` where `<NewMigrationName>` is a descriptive name for the migration
2. The generated filename will contain a timestamp prefix, so scan the `db/migration/` directory to find the actual path of the new file
3. Report the new file path to the user

## Naming Guidelines

Choose a descriptive name for the migration that clearly indicates what schema change is being made (e.g., `AddUserEmailIndex`, `CreateAuditLogTable`, `RemoveDeprecatedColumns`).
