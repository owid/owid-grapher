import { MigrationInterface, QueryRunner } from "typeorm"

export class RemoveIsExplorableFromGrapherConfigs1710499585939
    implements MigrationInterface
{
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
                `UPDATE ?? SET ?? = JSON_REMOVE(??, '$.isExplorable');`,
                [table, column, column]
            )
        }
    }

    public async down(_queryRunner: QueryRunner): Promise<void> {
        return
    }
}
