import { MigrationInterface, QueryRunner } from "typeorm"

export class ChartAddGeneratedColumns1683577595565
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
        ALTER TABLE charts
        ADD COLUMN slug VARCHAR(255) GENERATED ALWAYS AS (JSON_UNQUOTE(JSON_EXTRACT(config, '$.slug'))) VIRTUAL AFTER id,
        ADD COLUMN type VARCHAR(255) GENERATED ALWAYS AS (COALESCE(JSON_UNQUOTE(JSON_EXTRACT(config, '$.type')), 'LineChart')) VIRTUAL AFTER slug;`)

        await queryRunner.query(`-- sql
        CREATE INDEX charts_slug ON charts (slug);`)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
        DROP INDEX charts_slug ON charts;`)

        await queryRunner.query(`-- sql
        ALTER TABLE charts
        DROP COLUMN slug,
        DROP COLUMN type;`)
    }
}
