import { MigrationInterface, QueryRunner } from "typeorm"

const tables = [
    { table: "chart_configs", column: "patch" },
    { table: "chart_configs", column: "full" },
    { table: "chart_revisions", column: "config" },
]

export class ChangeToRelativeOriginUrls1757407543769
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        for (const { table, column } of tables) {
            await queryRunner.query(`-- sql
                UPDATE ${table} SET ${column} = JSON_SET(${column}, "$.originUrl", REGEXP_REPLACE(${column} ->> "$.originUrl", '^(https?://)?ourworldindata.org', '', 1, 1, 'i')) WHERE ${column} ->> "$.originUrl" IS NOT NULL
            `)
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        for (const { table, column } of tables) {
            await queryRunner.query(`-- sql
                UPDATE ${table} SET ${column} = JSON_SET(${column}, "$.originUrl", CONCAT('https://ourworldindata.org', ${column} ->> "$.originUrl"))
                WHERE ${column} ->> "$.originUrl" LIKE "/%"
            `)
        }
    }
}
