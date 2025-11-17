import { MigrationInterface, QueryRunner } from "typeorm"

export class DropHideLegendFromScatters1763372278902
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Drop the hideLegend property from all scatter plots
        await queryRunner.query(`-- sql
            UPDATE chart_configs
            SET
                full = JSON_REMOVE(full, '$.hideLegend'),
                patch = JSON_REMOVE(patch, '$.hideLegend')
            WHERE chartType = 'ScatterPlot'
                AND (full ->> '$.hideLegend' IS NOT NULL
                     OR patch ->> '$.hideLegend' IS NOT NULL);
        `)
    }

    public async down(): Promise<void> {
        // intentionally empty
    }
}
