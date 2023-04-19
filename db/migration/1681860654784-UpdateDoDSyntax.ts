import { MigrationInterface, QueryRunner } from "typeorm"

const tables = {
    charts: ["config"],
    chart_revisions: ["config"],
    suggested_chart_revisions: ["suggestedConfig", "originalConfig"],
}
const fields = ["subtitle", "note"]

export class UpdateDoDSyntax1681860654784 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        for (const [table, columns] of Object.entries(tables)) {
            for (const column of columns) {
                for (const field of fields) {
                    await queryRunner.query(`        
                        UPDATE ${table} SET ${column} = JSON_SET(
                            ${column},
                            '$.${field}',
                            JSON_UNQUOTE(
                                REGEXP_REPLACE(
                                    ${column}->>'$.${field}',
                                    'hover::[a-z]+::',
                                    '#dod:'
                                )
                            )
                        )
                        WHERE ${column}->>'$.${field}' IS NOT NULL
                    `)
                }
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // This migration removes category information so it can't be perfectly undone
        // e.g. hover::energy::nuclear -> #dod:nuclear
        // The best we can do is set all the categories to "general"
        for (const [table, columns] of Object.entries(tables)) {
            for (const column of columns) {
                for (const field of fields) {
                    await queryRunner.query(`        
                        UPDATE ${table} SET ${column} = JSON_SET(
                            ${column},
                            '$.${field}',
                            JSON_UNQUOTE(
                                REGEXP_REPLACE(
                                    ${column}->>'$.${field}',
                                    '#dod:',
                                    'hover::general::'
                                )
                            )
                        )
                        WHERE ${column}->>'$.${field}' IS NOT NULL
                    `)
                }
            }
        }
    }
}
