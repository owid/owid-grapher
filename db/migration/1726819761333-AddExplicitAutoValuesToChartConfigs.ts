import { MigrationInterface, QueryRunner } from "typeorm"

export class AddExplicitAutoValuesToChartConfigs1726819761333
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        const addExplicitAutoValueToFullChartConfigs = async (
            jsonPath: string,
            defaultValue: string
        ): Promise<void> => {
            await queryRunner.query(
                `
                -- sql
                    UPDATE chart_configs cc
                    -- the join is necessary to limit the update to charts only
                    JOIN charts c ON c.configId = cc.id
                    SET cc.full = JSON_SET(cc.full, ?, ?)
                    WHERE cc.full ->> ? IS NULL
                `,
                [jsonPath, defaultValue, jsonPath]
            )
        }

        await addExplicitAutoValueToFullChartConfigs(
            "$.timelineMinTime",
            "earliest"
        )
        await addExplicitAutoValueToFullChartConfigs(
            "$.timelineMaxTime",
            "latest"
        )
        await addExplicitAutoValueToFullChartConfigs("$.yAxis.min", "auto")
        await addExplicitAutoValueToFullChartConfigs("$.yAxis.max", "auto")
        await addExplicitAutoValueToFullChartConfigs("$.xAxis.min", "auto")
        await addExplicitAutoValueToFullChartConfigs("$.xAxis.max", "auto")
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const removeExplicitAutoValueFromFullChartConfigs = async (
            jsonPath: string,
            defaultValue: string
        ): Promise<void> => {
            await queryRunner.query(
                `
                    -- sql
                    UPDATE chart_configs cc
                    JOIN charts c ON c.configId = cc.id
                    SET cc.full = JSON_REMOVE(cc.full, ?)
                    WHERE JSON_EXTRACT(cc.full, ?) = ?
                `,
                [jsonPath, jsonPath, defaultValue]
            )
        }

        await removeExplicitAutoValueFromFullChartConfigs(
            "$.timelineMinTime",
            "earliest"
        )
        await removeExplicitAutoValueFromFullChartConfigs(
            "$.timelineMaxTime",
            "latest"
        )
        await removeExplicitAutoValueFromFullChartConfigs("$.yAxis.min", "auto")
        await removeExplicitAutoValueFromFullChartConfigs("$.yAxis.max", "auto")
        await removeExplicitAutoValueFromFullChartConfigs("$.xAxis.min", "auto")
        await removeExplicitAutoValueFromFullChartConfigs("$.xAxis.max", "auto")
    }
}
