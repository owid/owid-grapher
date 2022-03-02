import { MigrationInterface, QueryRunner } from "typeorm"

export class ScatterSizeDimensionLegend1646223315110
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            UPDATE charts
            JOIN chart_dimensions ON chart_dimensions.chartId = charts.id
            SET charts.config = JSON_REMOVE(
                charts.config,
                CONCAT("$.dimensions[", chart_dimensions.order, "].display")
            )
            WHERE charts.config->"$.type" = "ScatterPlot"
            AND chart_dimensions.property = "size"
        `)
    }

    public async down(): Promise<void> {
        // no way back :(
    }
}
