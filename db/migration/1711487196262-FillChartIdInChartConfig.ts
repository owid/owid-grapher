import { MigrationInterface, QueryRunner } from "typeorm"

export class FillChartIdInChartConfig1711487196262
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            UPDATE charts
            SET config = JSON_SET(config, '$.id', id)
            WHERE JSON_EXTRACT(config, '$.id') IS NULL OR JSON_TYPE(JSON_EXTRACT(config, '$.id')) = 'NULL'`)
    }

    public async down(): Promise<void> {
        return
    }
}
