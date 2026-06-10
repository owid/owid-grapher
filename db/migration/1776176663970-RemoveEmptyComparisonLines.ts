import { MigrationInterface, QueryRunner } from "typeorm"

export class RemoveEmptyComparisonLines1776176663970 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Remove comparisonLines from chart configs where the value is
        // an empty array ([]) or an array with only an empty object ([{}])
        await queryRunner.query(`
            -- sql
            UPDATE chart_configs
            SET
                full = JSON_REMOVE(full, '$.comparisonLines')
            WHERE
                JSON_EXTRACT(full, '$.comparisonLines') = CAST('[]' AS JSON)
                OR JSON_EXTRACT(full, '$.comparisonLines') = CAST('[{}]' AS JSON)
        `)
        await queryRunner.query(`
            -- sql
            UPDATE chart_configs
            SET
                patch = JSON_REMOVE(patch, '$.comparisonLines')
            WHERE
                JSON_EXTRACT(patch, '$.comparisonLines') = CAST('[]' AS JSON)
                OR JSON_EXTRACT(patch, '$.comparisonLines') = CAST('[{}]' AS JSON)
        `)
    }

    public async down(): Promise<void> {
        // No-op, can't restore the removed empty comparisonLines
    }
}
