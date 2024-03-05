import { MigrationInterface, QueryRunner } from "typeorm"

export class RemoveSizeDimensionFromSlopeCharts1709735276047
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        const slopeCharts = await queryRunner.query(
            `SELECT id, config FROM charts WHERE type = 'SlopeChart'`
        )

        // update all slope charts that currently have a size dimension
        for (const chart of slopeCharts) {
            const config = JSON.parse(chart.config)
            if (!config.dimensions) continue

            const index = config.dimensions.findIndex(
                (dimension: any) => dimension.property === "size"
            )
            if (index >= 0) {
                config.dimensions.splice(index, 1)
                await queryRunner.query(
                    `UPDATE charts SET config = ? WHERE id = ?`,
                    [JSON.stringify(config), chart.id]
                )
            }
        }
    }

    // eslint-disable-next-line
    public async down(queryRunner: QueryRunner): Promise<void> {}
}
