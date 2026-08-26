import { MigrationInterface, QueryRunner } from "typeorm"

const V010 = "https://files.ourworldindata.org/schemas/grapher-schema.010.json"
const V011 = "https://files.ourworldindata.org/schemas/grapher-schema.011.json"

const configColumns = [
    { table: "chart_configs", column: "patch" },
    { table: "chart_configs", column: "full" },
    { table: "chart_revisions", column: "config" },
]

export class BumpGrapherSchemaToV111783933313714 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        for (const { table, column } of configColumns) {
            await queryRunner.query(`-- sql
                UPDATE ${table}
                SET ${column} = JSON_SET(${column}, '$.$schema', '${V011}')`)
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        for (const { table, column } of configColumns) {
            await queryRunner.query(`-- sql
                UPDATE ${table}
                SET ${column} = JSON_SET(${column}, '$.$schema', '${V010}')`)
        }
    }
}
