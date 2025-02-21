import { MigrationInterface, QueryRunner } from "typeorm"

export class MigrateExcludeIncludeEntities1740064108477
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        // This query touches all configs where `excludedEntities` or `includedEntities`
        // are present and converts the existing array of ids to an array of names.
        // Example:
        // -  `excludedEntities`: [23, 31416, 8, 6, 3, 1, 13]
        // => `excludedEntityNames`: ["Australia", "Korea", "Italy", "Germany", "France", "United Kingdom", "United States"]

        const fields = [
            { oldName: "excludedEntities", newName: "excludedEntityNames" },
            { oldName: "includedEntities", newName: "includedEntityNames" },
        ]

        const tables = [
            { table: "chart_configs", column: "patch" },
            { table: "chart_configs", column: "full" },
            { table: "chart_revisions", column: "config" },
            { table: "suggested_chart_revisions", column: "suggestedConfig" },
        ]

        for (const { oldName, newName } of fields) {
            for (const { table, column } of tables) {
                await queryRunner.query(
                    `-- sql
                    WITH migrated AS (
                        SELECT
                            t.id,
                            ${column} -> "$.${oldName}" AS ${oldName},
                            JSON_ARRAYAGG(entities.name) AS ${newName}
                        FROM ${table} t,
                            JSON_TABLE(
                                t.${column},
                                '$.${oldName}[*]' COLUMNS (id INT PATH '$')
                            ) AS json_ids
                            JOIN entities ON json_ids.id = entities.id
                        WHERE ${column} -> "$.${oldName}" IS NOT NULL
                        GROUP BY t.id
                    )
                    UPDATE ${table} t
                    INNER JOIN migrated ON t.id = migrated.id
                    SET ${column} = JSON_SET(${column}, '$.${newName}', migrated.${newName})
                    WHERE ${column} ->> '$.${oldName}' IS NOT NULL;
                `
                )

                // Now that the new field is set, drop the old one
                await queryRunner.query(
                    `-- sql
                    UPDATE ${table}
                    SET ${column} = JSON_REMOVE(${column}, "$.${oldName}")
                    WHERE ${column} -> "$.${oldName}" IS NOT NULL
                `
                )
            }
        }
    }

    public async down(): Promise<void> {
        // intentially empty
    }
}
