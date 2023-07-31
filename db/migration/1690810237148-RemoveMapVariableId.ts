import { MigrationInterface, QueryRunner } from "typeorm"

export class RemoveMapVariableId1690810237148 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        const tables = {
            suggested_chart_revisions: "suggestedConfig",
            chart_revisions: "config",
            charts: "config",
        }

        for (const [tableName, columnName] of Object.entries(tables)) {
            await queryRunner.query(`-- sql
                UPDATE ${tableName}
                SET ${columnName} = JSON_REMOVE(
                    JSON_SET(
                        ${columnName},
                        "$.map.columnSlug",
                        CAST(${columnName} ->> "$.map.variableId" AS CHAR(10))
                    ),
                    "$.map.variableId"
                )
                WHERE ${columnName} ->> "$.map.variableId" IS NOT NULL
            `)
        }
    }

    public async down(_queryRunner: QueryRunner): Promise<void> {
        return
    }
}
