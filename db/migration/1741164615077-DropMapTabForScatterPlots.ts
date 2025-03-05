import { MigrationInterface, QueryRunner } from "typeorm"

export class DropMapTabForScatterPlots1741164615077
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Drop the map tab for all scatter plots (hasMapTab is false by default)
        await queryRunner.query(`-- sql
            update chart_configs
            join charts on chart_configs.id = charts.configId
            set
                full = json_remove(full, '$.hasMapTab'),
                patch = json_remove(patch, '$.hasMapTab')
            where chartType = 'ScatterPlot' and full ->> '$.hasMapTab' = 'true';
        `)
    }

    public async down(): Promise<void> {
        // intentionally empty
    }
}
