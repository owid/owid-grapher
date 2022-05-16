import { MigrationInterface, QueryRunner } from "typeorm"

export class RemoveMinPopulationFilter1652693645426
    implements MigrationInterface
{
    name = "RemoveMinPopulationFilter1652693645426"

    public async up(queryRunner: QueryRunner): Promise<void> {
        const tables = {
            charts: "config",
            suggested_chart_revisions: "suggestedConfig",
        }

        for (const [tableName, columnName] of Object.entries(tables)) {
            queryRunner.query(`UPDATE ${tableName}
        SET ${columnName} = JSON_REMOVE(${columnName}, '$.minPopulationFilter')
        WHERE JSON_CONTAINS_PATH(${columnName}, 'one', '$.minPopulationFilter') = 1;`)
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {}
}
