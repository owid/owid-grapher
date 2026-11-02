import { MigrationInterface, QueryRunner } from "typeorm"

const V011 = "https://files.ourworldindata.org/schemas/grapher-schema.011.json"
const V012 = "https://files.ourworldindata.org/schemas/grapher-schema.012.json"

const configColumns = [
    { table: "chart_configs", column: "config" },
    { table: "chart_revisions", column: "config" },
]

/**
 * Removes the "gv+owid" (Gates Ventures) logo option: configs using it switch
 * to the OWID logo, and every config is restamped to schema v012
 */
export class RemoveGatesVenturesLogo1793300000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        for (const { table, column } of configColumns) {
            await queryRunner.query(`-- sql
                UPDATE ${table}
                SET ${column} = JSON_SET(${column}, '$.logo', 'owid')
                WHERE ${column} ->> '$.logo' = 'gv+owid'`)
            await queryRunner.query(`-- sql
                UPDATE ${table}
                SET ${column} = JSON_SET(${column}, '$.$schema', '${V012}')`)
        }
    }

    // Restamps the schema version, but doesn't restore the gv+owid logos
    public async down(queryRunner: QueryRunner): Promise<void> {
        for (const { table, column } of configColumns) {
            await queryRunner.query(`-- sql
                UPDATE ${table}
                SET ${column} = JSON_SET(${column}, '$.$schema', '${V011}')`)
        }
    }
}
