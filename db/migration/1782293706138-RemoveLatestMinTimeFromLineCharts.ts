import { MigrationInterface, QueryRunner } from "typeorm"

export class RemoveLatestMinTimeFromLineCharts1782293706138 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // `minTime: "latest"` collapses the selected time range to a single
        // year. That's a no-op for the map and discrete-bar tabs (they only
        // ever render the end time), but it breaks the line and slope tabs,
        // which render a time range: they show a single point instead of a
        // line.
        //
        // Remove the relic `minTime: "latest"` from charts that have a line or
        // slope tab reachable. We deliberately leave it in place for charts
        // without a line/slope tab (e.g. scatter-only charts), where pinning to
        // the latest year is intentional.
        //
        // Note: when `chartTypes` is absent, Grapher defaults to
        // [LineChart, DiscreteBar], i.e. a line tab is reachable, so those
        // charts are included too.
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
                )
        `)
    }

    public async down(): Promise<void> {
        // No-op: we can't reliably distinguish charts that had
        // `minTime: "latest"` removed by this migration from those that never
        // had it, and restoring it would reintroduce the bug.
    }
}
