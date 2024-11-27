import { MigrationInterface, QueryRunner } from "typeorm"

export class RemoveHasChartTabFromFullConfigs1732698153785
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            -- sql
            UPDATE chart_configs
            SET full = JSON_REMOVE(full, '$.type', '$.hasChartTab')
        `)
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    public async down(): Promise<void> {}
}
