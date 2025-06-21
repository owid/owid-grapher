import { MigrationInterface, QueryRunner } from "typeorm"

const tables = [
    { table: "chart_configs", column: "patch" },
    { table: "chart_configs", column: "full" },
    { table: "chart_revisions", column: "config" },
]

export class RemoveColorScaleMinValue1750251210487
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        for (const { table, column } of tables) {
            await queryRunner.query(
                `-- sql
                    UPDATE ${table}
                    SET ${column} = JSON_REMOVE(
                        JSON_SET(${column}, "$.map.colorScale.customNumericValues", JSON_MERGE_PRESERVE(
                            JSON_ARRAY(COALESCE(${column} -> "$.map.colorScale.customNumericMinValue", CAST(0 AS JSON))),
                            COALESCE(${column} -> "$.map.colorScale.customNumericValues", JSON_ARRAY())
                        )),
                        "$.map.colorScale.customNumericMinValue"
                    )
                    WHERE ${column} ->> "$.map.colorScale.customNumericMinValue" IS NOT NULL
                    OR ${column} ->> "$.map.colorScale.customNumericValues" IS NOT NULL
                `
            )
            await queryRunner.query(
                `-- sql
                    UPDATE ${table}
                    SET ${column} = JSON_REMOVE(
                        JSON_SET(${column}, "$.colorScale.customNumericValues", JSON_MERGE_PRESERVE(
                            JSON_ARRAY(COALESCE(${column} -> "$.colorScale.customNumericMinValue", CAST(0 AS JSON))),
                            COALESCE(${column} -> "$.colorScale.customNumericValues", JSON_ARRAY())
                        )),
                        "$.colorScale.customNumericMinValue"
                    )
                    WHERE ${column} ->> "$.colorScale.customNumericMinValue" IS NOT NULL
                    OR ${column} ->> "$.colorScale.customNumericValues" IS NOT NULL
                `
            )

            await queryRunner.query(
                `-- sql
                    update ${table} set ${column} = JSON_SET(${column}, "$.$schema", "https://files.ourworldindata.org/schemas/grapher-schema.008.json")`
            )
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        for (const { table, column } of tables) {
            // Restore customNumericMinValue from first element of customNumericValues for map.colorScale
            await queryRunner.query(
                `-- sql
                    UPDATE ${table}
                    SET ${column} = JSON_SET(
                        ${column},
                        "$.map.colorScale.customNumericMinValue",
                        ${column} -> "$.map.colorScale.customNumericValues[0]"
                    )
                    WHERE JSON_LENGTH(${column} -> "$.map.colorScale.customNumericValues") > 0
                `
            )

            // Remove first element from customNumericValues array for map.colorScale
            await queryRunner.query(
                `-- sql
                    UPDATE ${table}
                    SET ${column} = JSON_SET(
                        ${column},
                        "$.map.colorScale.customNumericValues",
                        JSON_REMOVE(${column} -> "$.map.colorScale.customNumericValues", "$[0]")
                    )
                    WHERE JSON_LENGTH(${column} -> "$.map.colorScale.customNumericValues") > 1
                `
            )

            // Restore customNumericMinValue from first element of customNumericValues for colorScale
            await queryRunner.query(
                `-- sql
                    UPDATE ${table}
                    SET ${column} = JSON_SET(
                        ${column},
                        "$.colorScale.customNumericMinValue",
                        ${column} -> "$.colorScale.customNumericValues[0]"
                    )
                    WHERE JSON_LENGTH(${column} -> "$.colorScale.customNumericValues") > 0
                `
            )

            // Remove first element from customNumericValues array for colorScale
            await queryRunner.query(
                `-- sql
                    UPDATE ${table}
                    SET ${column} = JSON_SET(
                        ${column},
                        "$.colorScale.customNumericValues",
                        JSON_REMOVE(${column} -> "$.colorScale.customNumericValues", "$[0]")
                    )
                    WHERE JSON_LENGTH(${column} -> "$.colorScale.customNumericValues") > 1
                `
            )

            await queryRunner.query(
                `-- sql
                    UPDATE ${table} SET ${column} = JSON_SET(${column}, "$.$schema", "https://files.ourworldindata.org/schemas/grapher-schema.007.json")
                `
            )
        }
    }
}
