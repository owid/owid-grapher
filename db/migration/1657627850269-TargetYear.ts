import { MigrationInterface, QueryRunner } from "typeorm"

export class TargetYear1657627850269 implements MigrationInterface {
    name = "TargetYear1657627850269"

    async runAll(queryRunner: QueryRunner, query: string): Promise<void> {
        // There is no way for a query to target all indices of a JSON array, so we just run it multiple times.
        for (let i = 0; i < 50; i++) {
            const currentQuery = query.replace(/§§/g, i.toString())
            await queryRunner.query(currentQuery)
        }
    }

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Get rid of all `dimension.targetYear: null` values, across all chart types.
        await this.runAll(
            queryRunner,
            `UPDATE charts
            SET config = JSON_REMOVE(config, "$.dimensions[§§].targetYear")
            WHERE config ->> "$.dimensions[§§].targetYear" = 'null'`
        )

        // Setting targetYear only makes sense for ScatterPlots and Marimekko charts.
        // Get rid of all `dimension.targetYear` values that are set on charts that are not of type `ScatterPlot` or `Marimekko`.
        await this.runAll(
            queryRunner,
            `UPDATE charts
            SET config = JSON_REMOVE(config, "$.dimensions[§§].targetYear")
            WHERE config ->> "$.dimensions[§§].targetYear" IS NOT NULL
            AND COALESCE(config ->> '$.type', 'LineChart') NOT IN ('ScatterPlot', 'Marimekko')`
        )
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    public async down(): Promise<void> {}
}
