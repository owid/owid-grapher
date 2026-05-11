import { MigrationInterface, QueryRunner } from "typeorm"

const nullableAutoUpdatedUpdatedAtTablesWithNullDefault = [
    "chart_dimensions",
    "chart_revisions",
    "chart_slug_redirects",
    "chart_tags",
    "dataset_tags",
    "datasets",
    "entities",
    "namespaces",
    "post_tags",
    "sources",
    "tags",
    "users",
    "variables",
]

const nullableAutoUpdatedUpdatedAtTables = [
    ...nullableAutoUpdatedUpdatedAtTablesWithNullDefault,
    "explorers",
    "posts_gdocs",
]

const manuallyManagedUpdatedAtTables = ["chart_configs", "charts"]

const nullableTimestampUpdatedAtTables = [
    "donors",
    "multi_dim_redirects",
    "multi_dim_x_chart_configs",
    "narrative_charts",
    "posts_gdocs_tombstones",
    "redirects",
    "static_viz",
]

const nullableTimestampCreatedAtTables = [
    "donors",
    "files",
    "multi_dim_redirects",
    "multi_dim_x_chart_configs",
    "narrative_charts",
    "posts_gdocs_tombstones",
    "redirects",
    "static_viz",
]

export class BackfillAndConstrainTimestamps1776260942258 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        for (const table of nullableTimestampCreatedAtTables) {
            await queryRunner.query(
                `-- sql
                UPDATE ${table}
                SET createdAt = CURRENT_TIMESTAMP
                WHERE createdAt IS NULL`
            )
        }

        await queryRunner.query(
            `-- sql
            UPDATE explorers
            SET createdAt = CURRENT_TIMESTAMP
            WHERE createdAt IS NULL`
        )

        // active_datasets is a view over datasets, so datasets covers it.
        for (const table of [
            ...nullableAutoUpdatedUpdatedAtTables,
            ...manuallyManagedUpdatedAtTables,
            ...nullableTimestampUpdatedAtTables,
        ]) {
            await queryRunner.query(
                `-- sql
                UPDATE ${table}
                SET updatedAt = COALESCE(createdAt, CURRENT_TIMESTAMP)
                WHERE updatedAt IS NULL`
            )
        }

        for (const table of nullableTimestampCreatedAtTables) {
            await queryRunner.query(
                `-- sql
                ALTER TABLE ${table}
                MODIFY COLUMN createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP`
            )
        }

        await queryRunner.query(
            `-- sql
            ALTER TABLE explorers
            MODIFY COLUMN createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`
        )

        for (const table of nullableAutoUpdatedUpdatedAtTables) {
            await queryRunner.query(
                `-- sql
                ALTER TABLE ${table}
                MODIFY COLUMN updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`
            )
        }

        for (const table of manuallyManagedUpdatedAtTables) {
            await queryRunner.query(
                `-- sql
                ALTER TABLE ${table}
                MODIFY COLUMN updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`
            )
        }

        for (const table of nullableTimestampUpdatedAtTables) {
            await queryRunner.query(
                `-- sql
                ALTER TABLE ${table}
                MODIFY COLUMN updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`
            )
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        for (const table of nullableTimestampCreatedAtTables) {
            await queryRunner.query(
                `-- sql
                ALTER TABLE ${table}
                MODIFY COLUMN createdAt TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP`
            )
        }

        await queryRunner.query(
            `-- sql
            ALTER TABLE explorers
            MODIFY COLUMN createdAt DATETIME NULL DEFAULT CURRENT_TIMESTAMP`
        )

        for (const table of nullableAutoUpdatedUpdatedAtTablesWithNullDefault) {
            await queryRunner.query(
                `-- sql
                ALTER TABLE ${table}
                MODIFY COLUMN updatedAt DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP`
            )
        }

        await queryRunner.query(
            `-- sql
            ALTER TABLE posts_gdocs
            MODIFY COLUMN updatedAt DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`
        )

        await queryRunner.query(
            `-- sql
            ALTER TABLE explorers
            MODIFY COLUMN updatedAt DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`
        )

        for (const table of manuallyManagedUpdatedAtTables) {
            await queryRunner.query(
                `-- sql
                ALTER TABLE ${table}
                MODIFY COLUMN updatedAt DATETIME NULL DEFAULT NULL`
            )
        }

        for (const table of nullableTimestampUpdatedAtTables) {
            await queryRunner.query(
                `-- sql
                ALTER TABLE ${table}
                MODIFY COLUMN updatedAt TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`
            )
        }
    }
}
