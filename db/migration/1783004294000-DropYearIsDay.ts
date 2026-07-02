import { MigrationInterface, QueryRunner } from "typeorm"

const V010 = "https://files.ourworldindata.org/schemas/grapher-schema.010.json"
const V011 = "https://files.ourworldindata.org/schemas/grapher-schema.011.json"

const configColumns = [
    { table: "chart_configs", column: "patch" },
    { table: "chart_configs", column: "full" },
    { table: "chart_revisions", column: "config" },
]

interface Display {
    yearIsDay?: boolean
    timeInterval?: string
}
interface Config {
    dimensions?: { display?: Display }[]
}

const parseConfig = (config: string | Config): Config =>
    typeof config === "string" ? JSON.parse(config) : config

export class DropYearIsDay1783004294000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. variables.display (top-level JSON): yearIsDay: true -> timeInterval: "day"
        await queryRunner.query(`-- sql
            UPDATE variables
            SET display = JSON_SET(display, '$.timeInterval', 'day')
            WHERE display ->> '$.yearIsDay' = 'true'
              AND display ->> '$.timeInterval' IS NULL`)
        await queryRunner.query(`-- sql
            UPDATE variables
            SET display = JSON_REMOVE(display, '$.yearIsDay')
            WHERE JSON_CONTAINS_PATH(display, 'one', '$.yearIsDay')`)

        // 2. chart configs: bump $schema for all rows, then rewrite the
        // yearIsDay flag inside dimensions[].display. The latter is an array, so
        // it's done in JS rather than with JSON path functions.
        for (const { table, column } of configColumns) {
            await queryRunner.query(`-- sql
                UPDATE ${table}
                SET ${column} = JSON_SET(${column}, '$.$schema', '${V011}')`)

            const rows: { id: string; config: string | Config }[] =
                await queryRunner.query(`-- sql
                    SELECT id, ${column} AS config
                    FROM ${table}
                    WHERE JSON_CONTAINS_PATH(${column}, 'one', '$.dimensions[*].display.yearIsDay')`)

            for (const { id, config } of rows) {
                const parsed = parseConfig(config)
                for (const dimension of parsed.dimensions ?? []) {
                    const display = dimension.display
                    if (!display) continue
                    if (
                        display.yearIsDay === true &&
                        display.timeInterval === undefined
                    )
                        display.timeInterval = "day"
                    delete display.yearIsDay
                }
                await queryRunner.query(
                    `UPDATE ${table} SET ${column} = ? WHERE id = ?`,
                    [JSON.stringify(parsed), id]
                )
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Best-effort reverse: timeInterval "day" -> yearIsDay: true. Sub-yearly
        // week/month intervals have no yearIsDay equivalent and are left as-is.
        await queryRunner.query(`-- sql
            UPDATE variables
            SET display = JSON_REMOVE(
                JSON_SET(display, '$.yearIsDay', TRUE),
                '$.timeInterval'
            )
            WHERE display ->> '$.timeInterval' = 'day'`)

        for (const { table, column } of configColumns) {
            const rows: { id: string; config: string | Config }[] =
                await queryRunner.query(`-- sql
                    SELECT id, ${column} AS config
                    FROM ${table}
                    WHERE JSON_SEARCH(${column}, 'one', 'day', NULL, '$.dimensions[*].display.timeInterval') IS NOT NULL`)

            for (const { id, config } of rows) {
                const parsed = parseConfig(config)
                for (const dimension of parsed.dimensions ?? []) {
                    const display = dimension.display
                    if (display?.timeInterval === "day") {
                        display.yearIsDay = true
                        delete display.timeInterval
                    }
                }
                await queryRunner.query(
                    `UPDATE ${table} SET ${column} = ? WHERE id = ?`,
                    [JSON.stringify(parsed), id]
                )
            }

            await queryRunner.query(`-- sql
                UPDATE ${table}
                SET ${column} = JSON_SET(${column}, '$.$schema', '${V010}')`)
        }
    }
}
