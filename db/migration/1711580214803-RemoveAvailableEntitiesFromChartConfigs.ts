import { MigrationInterface, QueryRunner } from "typeorm"

export class RemoveAvailableEntitiesFromChartConfigs1711580214803
    implements MigrationInterface
{
    // Removes `$.data.availableEntities` from chart configs
    // In doing that, we can also remove the whole `$.data` object, because it is not used anymore
    public async up(queryRunner: QueryRunner): Promise<void> {
        const configColumns = [
            { table: "charts", column: "config" },
            { table: "chart_revisions", column: "config" },
            { table: "suggested_chart_revisions", column: "suggestedConfig" },
            { table: "variables", column: "grapherConfigAdmin" },
            { table: "variables", column: "grapherConfigETL" },
        ]

        for (const { table, column } of configColumns) {
            await queryRunner.query(
                `-- sql
                UPDATE ??
                SET ?? = JSON_REMOVE(??, "$.data")
                WHERE JSON_CONTAINS_PATH(??, "one", "$.data")
            `,
                [table, column, column, column]
            )

            // Update schema version to 004
            await queryRunner.query(
                `-- sql
                UPDATE ??
                SET ?? = JSON_SET(??, "$.$schema", "https://files.ourworldindata.org/schemas/grapher-schema.005.json")`,
                [table, column, column]
            )
        }
    }

    public async down(): Promise<void> {
        return
    }
}
