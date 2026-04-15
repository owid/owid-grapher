import { MigrationInterface, QueryRunner } from "typeorm"

export class ReverseStackedChartDimensionsOrder1776250055561 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        const configs: { id: string; patch: string; full: string }[] =
            await queryRunner.query(`
                -- sql
                SELECT id, patch, full
                FROM chart_configs
                WHERE (
                    JSON_SEARCH(full->'$.chartTypes', 'one', 'StackedArea') IS NOT NULL
                    OR JSON_SEARCH(full->'$.chartTypes', 'one', 'StackedBar') IS NOT NULL
                )
            `)

        for (const config of configs) {
            const patch = JSON.parse(config.patch)
            const full = JSON.parse(config.full)

            // Reverse the dimensions order
            if (patch.dimensions?.length > 1) patch.dimensions.reverse()
            if (full.dimensions?.length > 1) full.dimensions.reverse()

            // Reverse the entity stacking order
            if (patch.selectedEntityNames?.length > 1)
                patch.selectedEntityNames.reverse()
            if (full.selectedEntityNames?.length > 1)
                full.selectedEntityNames.reverse()

            await queryRunner.query(
                `UPDATE chart_configs SET patch = ?, full = ? WHERE id = ?`,
                [JSON.stringify(patch), JSON.stringify(full), config.id]
            )
        }

        // Reverse the order column in chart_dimensions for standalone charts.
        // This table is a denormalized lookup regenerated on save, but we keep
        // it in sync for consistency.
        await queryRunner.query(`
            -- sql
            UPDATE chart_dimensions cd
            JOIN charts c ON c.id = cd.chartId
            JOIN chart_configs cc ON c.configId = cc.id
            SET cd.\`order\` = (
                SELECT MAX(cd2.\`order\`)
                FROM (SELECT * FROM chart_dimensions) cd2
                WHERE cd2.chartId = cd.chartId AND cd2.property = 'y'
            ) - cd.\`order\`
            WHERE cd.property = 'y'
            AND (
                JSON_SEARCH(cc.full->'$.chartTypes', 'one', 'StackedArea') IS NOT NULL
                OR JSON_SEARCH(cc.full->'$.chartTypes', 'one', 'StackedBar') IS NOT NULL
            )
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // The migration is its own inverse: reversing twice restores
        // the original order.
        await this.up(queryRunner)
    }
}
