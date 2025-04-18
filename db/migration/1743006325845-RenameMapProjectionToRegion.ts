import { MigrationInterface, QueryRunner } from "typeorm"

const tables = [
    { table: "chart_configs", column: "patch" },
    { table: "chart_configs", column: "full" },
    { table: "chart_revisions", column: "config" },
    { table: "suggested_chart_revisions", column: "suggestedConfig" },
]

async function updateGrapherSchemaField(
    queryRunner: QueryRunner,
    newVersion: `${number}${number}${number}`
): Promise<void> {
    const schema = `https://files.ourworldindata.org/schemas/grapher-schema.${newVersion}.json`

    for (const { table, column } of tables) {
        await queryRunner.query(
            `-- sql
                UPDATE ${table}
                SET ${column} = JSON_SET(${column}, '$.$schema', ?)
            `,
            [schema]
        )
    }
}

export class RenameMapProjectionToRegion1743006325845
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        for (const { table, column } of tables) {
            await queryRunner.query(
                `-- sql
                    UPDATE ${table}
                    SET ${column} = JSON_REMOVE(
                        JSON_SET(
                            ${column},
                            '$.map.region',
                            ${column}->'$.map.projection'
                        ),
                        '$.map.projection'
                    )
                    WHERE ${column} ->> '$.map.projection' IS NOT NULL
                `
            )
        }

        await updateGrapherSchemaField(queryRunner, "007")
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        for (const { table, column } of tables) {
            await queryRunner.query(
                `-- sql
                    UPDATE ${table}
                    SET ${column} = JSON_REMOVE(
                        JSON_SET(
                            ${column},
                            '$.map.projection',
                            ${column}->'$.map.region'
                        ),
                        '$.map.region'
                    )
                    WHERE ${column} ->> '$.map.region' IS NOT NULL
                `
            )
        }

        await updateGrapherSchemaField(queryRunner, "006")
    }
}
