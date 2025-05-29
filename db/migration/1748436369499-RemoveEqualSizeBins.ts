import { MigrationInterface, QueryRunner } from "typeorm"

const tables = [
    { table: "chart_configs", column: "patch" },
    { table: "chart_configs", column: "full" },
    { table: "chart_revisions", column: "config" },
    { table: "suggested_chart_revisions", column: "suggestedConfig" },
]

export class RemoveEqualSizeBins1748436369499 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Remove equalSizeBins from colorScale and map.colorScale for all charts
        for (const { table, column } of tables) {
            await queryRunner.query(
                `-- sql
                    UPDATE ${table}
                    SET ${column} = JSON_REMOVE(
                        ${column},
                        "$.colorScale.equalSizeBins",
                        "$.map.colorScale.equalSizeBins"
                    )
                    WHERE ${column} ->> "$.colorScale.equalSizeBins" IS NOT NULL
                       OR ${column} ->> "$.map.colorScale.equalSizeBins" IS NOT NULL
                `
            )
        }
    }

    public async down(_queryRunner: QueryRunner): Promise<void> {
        // intentionally left empty
    }
}
