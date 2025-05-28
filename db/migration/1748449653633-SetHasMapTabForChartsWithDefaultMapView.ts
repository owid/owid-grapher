import { MigrationInterface, QueryRunner } from "typeorm"

const tables = [
    { table: "chart_configs", column: "patch" },
    { table: "chart_configs", column: "full" },
    { table: "chart_revisions", column: "config" },
]

export class SetHasMapTabForChartsWithDefaultMapView1748449653633
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        for (const { table, column } of tables) {
            // Find all charts that show a map by default (tab=map),
            // but don't explicitly set hasMapTab to true
            await queryRunner.query(
                `-- sql
                    UPDATE ${table}
                    SET ${column} = JSON_SET(
                        ${column},
                        "$.hasMapTab",
                        true
                    )
                    WHERE ${column} ->> "$.tab" = "map"
                      AND (${column} ->> "$.hasMapTab" IS NULL OR ${column} ->> "$.hasMapTab" = "false")
                `
            )
        }
    }

    public async down(): Promise<void> {
        // intentionally empty
    }
}
