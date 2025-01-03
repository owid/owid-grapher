import { MigrationInterface, QueryRunner } from "typeorm"

export class RemoveRelativeModeFromDiscreteBarCharts1735896576517
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            -- sql
            update chart_configs
            set
                patch = json_remove(patch, '$.stackMode'),
                full = json_remove(full, '$.stackMode')
            where
                chartType = 'DiscreteBar'
                and full ->> '$.stackMode' = 'relative';
        `)
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    public async down(): Promise<void> {}
}
