import { MigrationInterface, QueryRunner } from "typeorm"

export class DisableLineBarChartSwitching1764661863496
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            UPDATE chart_configs cc
            SET
                full = JSON_SET(full, '$.tab', 'discrete-bar'),
                patch = JSON_SET(patch, '$.tab', 'discrete-bar')
            WHERE
                -- Only update charts that have both LineChart and DiscreteBar chart types
                (
                    cc.full ->> '$.chartTypes' is null
                    OR (
                        JSON_SEARCH(cc.full -> '$.chartTypes', 'one', 'LineChart') IS NOT NULL
                        AND JSON_SEARCH(cc.full -> '$.chartTypes', 'one', 'DiscreteBar') IS NOT NULL
                    )
                )
                -- Only update charts with identical minTime and maxTime (i.e. the bar chart is initially shown)
                AND COALESCE(cc.full ->> '$.minTime', 'earliest') = COALESCE(cc.full ->> '$.maxTime', 'latest')
                -- Only update charts without explicit tab setting or with tab set to 'line'
                AND (
                    cc.full ->> '$.tab' IS NULL
                    OR cc.full ->> '$.tab' = 'line'
                );
     `)
    }

    public async down(): Promise<void> {
        // The migration is irreversible
    }
}
