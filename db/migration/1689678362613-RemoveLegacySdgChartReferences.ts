import { MigrationInterface, QueryRunner } from "typeorm"

export class RemoveLegacySdgChartReferences1689678362613
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            DROP TABLE IF EXISTS legacy_sdg_chart_references;
        `)
    }

    public async down(_queryRunner: QueryRunner): Promise<void> {
        // No down migration
    }
}
