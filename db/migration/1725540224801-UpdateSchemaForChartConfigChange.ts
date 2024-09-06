import { MigrationInterface, QueryRunner } from "typeorm"

export class UpdateSchemaForChartConfigChange1725540224801
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            UPDATE charts
            SET config = JSON_SET(config, '$.$schema', 'https://files.ourworldindata.org/schemas/grapher-schema.005.json');
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            UPDATE charts
            SET config = JSON_SET(config, '$.$schema', 'https://files.ourworldindata.org/schemas/grapher-schema.004.json');
        `)
    }
}
