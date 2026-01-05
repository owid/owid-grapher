import { MigrationInterface, QueryRunner } from "typeorm"

export class FixSingleTimeLineCharts1767611505051
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            UPDATE chart_configs cc
            SET
                full = JSON_REMOVE(full, '$.minTime'),
                patch = JSON_REMOVE(patch, '$.minTime')
            WHERE
                -- Only update charts that have both a line chart and a map
                (
                    cc.full ->> '$.chartTypes' is null
                    OR (
                        JSON_SEARCH(cc.full -> '$.chartTypes', 'one', 'LineChart') IS NOT NULL
                        AND cc.full ->> '$.hasMapTab' = 'true'
                    )
                )
                -- Only update charts where the default view is a map
                AND cc.full ->> '$.tab' = 'map'
                -- Only update charts with identical minTime and maxTime
                AND COALESCE(cc.full ->> '$.minTime', 'earliest') = COALESCE(cc.full ->> '$.maxTime', 'latest')
     `)
    }

    public async down(): Promise<void> {
        // The migration is irreversible
    }
}
