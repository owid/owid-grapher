import { MigrationInterface, QueryRunner } from "typeorm"

export class RemoveLatestMinTimeFromLineCharts1782293706138 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // `minTime: "latest"` collapses the selected time range to a single
        // year. That's a no-op for the map and discrete-bar tabs (they only
        // ever render the end time), but it breaks any tab that renders a time
        // range — line, slope, and single-indicator dumbbell charts — which end
        // up showing a single point instead of a line. The symptom is most
        // visible wherever the range view is rendered directly, without a
        // tab-switch (e.g. country profiles, `?tab=line` deep links), since the
        // standalone UI silently expands the range when you switch tabs.
        //
        // Remove the relic `minTime: "latest"` from charts that have such a tab
        // reachable. We deliberately leave it in place for charts without one
        // (e.g. scatter-only charts), where pinning to the latest year is
        // intentional.
        //
        // Notes:
        // - When `chartTypes` is absent, Grapher defaults to
        //   [LineChart, DiscreteBar], i.e. a line tab is reachable.
        // - Dumbbell charts render a time range when plotting a single
        //   indicator and a single time otherwise; removing `minTime` fixes the
        //   former and is a no-op for the latter (single-time selection forces
        //   start == end regardless), so it's safe to include all of them.
        await queryRunner.query(`
            -- sql
            UPDATE chart_configs
            SET
                full = JSON_REMOVE(full, '$.minTime'),
                patch = JSON_REMOVE(patch, '$.minTime')
            WHERE
                full ->> '$.minTime' = 'latest'
                AND (
                    full ->> '$.chartTypes' IS NULL
                    OR JSON_CONTAINS(full -> '$.chartTypes', '"LineChart"')
                    OR JSON_CONTAINS(full -> '$.chartTypes', '"SlopeChart"')
                    OR JSON_CONTAINS(full -> '$.chartTypes', '"Dumbbell"')
                )
        `)
    }

    public async down(): Promise<void> {
        // No-op: we can't reliably distinguish charts that had
        // `minTime: "latest"` removed by this migration from those that never
        // had it, and restoring it would reintroduce the bug.
    }
}
