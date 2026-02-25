import { MigrationInterface, QueryRunner } from "typeorm"

/**
 * BEFORE this migration, we had a legacy `selectedEntityIds` property on most old chart configs.
 * It was used _only_ in case the `selectedEntityNames` property was not present.
 */
export class MigrateSelectedEntityIds1681310285750 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        const tables = {
            charts: "config",
            chart_revisions: "config",
            suggested_chart_revisions: "suggestedConfig",
        }

        for (const [tableName, columnName] of Object.entries(tables)) {
            // This query touches all configs where `selectedEntityIds` is present and `selectedEntityNames` is not yet present.
            // Then, it converts the existing array of ids to an array of names, and sets it on the config.
            // Example:
            // -  `selectedEntityIds`: [23, 31416, 8, 6, 3, 1, 13]
            // => `selectedEntityNames`: ["Australia", "Korea", "Italy", "Germany", "France", "United Kingdom", "United States"]
            await queryRunner.query(
                `-- sql
                with migrated as (
                    (SELECT t.id,
                            ${columnName} -> "$.selectedEntityIds" AS selectedEntityIds,
                            JSON_ARRAYAGG(entities.name)    AS migratedSelectedEntityNames
                    FROM ${tableName} t,
                        JSON_TABLE(
                                t.${columnName},
                                '$.selectedEntityIds[*]' COLUMNS (id INT PATH '$')
                            ) AS json_ids
                            JOIN entities ON json_ids.id = entities.id
                    WHERE ${columnName} -> "$.selectedEntityIds" IS NOT NULL
                    GROUP BY t.id))
                UPDATE ${tableName}
                    INNER JOIN migrated ON ${tableName}.id = migrated.id
                SET ${columnName} = JSON_SET(${columnName}, "$.selectedEntityNames", migrated.migratedSelectedEntityNames)
                WHERE ${columnName} -> "$.selectedEntityNames" IS NULL
            `
            )

            // Now that `selectedEntityNames` is set, we can drop `selectedEntityIds`.
            await queryRunner.query(
                `-- sql
                UPDATE ${tableName}
                SET ${columnName} = JSON_REMOVE(${columnName}, "$.selectedEntityIds")
                WHERE ${columnName} -> "$.selectedEntityIds" IS NOT NULL
            `
            )
        }
    }

    public async down(): Promise<void> {
        // no going back!
    }
}
