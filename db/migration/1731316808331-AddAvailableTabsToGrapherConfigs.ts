import { MigrationInterface, QueryRunner } from "typeorm"

export class AddAvailableTabsToGrapherConfigs1731316808331
    implements MigrationInterface
{
    private async updateSchema(
        queryRunner: QueryRunner,
        newSchema: string
    ): Promise<void> {
        await queryRunner.query(
            `
            -- sql
                UPDATE chart_configs
                SET
                    patch = JSON_SET(patch, '$.$schema', ?),
                    full = JSON_SET(full, '$.$schema', ?)
            `,
            [newSchema, newSchema]
        )
    }

    private async addAvailableTabsToGrapherConfigs(
        queryRunner: QueryRunner
    ): Promise<void> {
        // CASES:
        // 1. hasMapTab=false, hasChartTab=false -> availableTabs is unset
        // 2. hasMapTab=false, hasChartTab=true -> availableTabs={ [chartType]: true }
        // 3. hasMapTab=true, hasChartTab=false -> availableTabs={ WorldMap: true }
        // 4. hasMapTab=true, hasChartTab=true -> availableTabs={ WorldMap: true, [chartType]: true }

        for (const configType of ["patch", "full"]) {
            // We could run a single query that updates all configs at once,
            // but then some values in `availableTabs` would be set to 'false'.
            // That shouldn't be a problem (and over time we'll probably see
            // configs where chart types are set to false), but for now I like
            // to keep it clean.

            // CASE 2: hasMapTab=false, hasChartTab=true -> availableTabs={ [chartType]: true }
            await queryRunner.query(
                `
                -- sql
                    UPDATE chart_configs
                    SET ?? = JSON_SET(
                        ??,
                        '$.availableTabs',
                        JSON_OBJECT(COALESCE(?? ->> '$.type', 'LineChart'), TRUE)
                    )
                    WHERE
                        (?? ->> '$.hasMapTab' = 'false' OR ?? ->> '$.hasMapTab' IS NULL)
                        AND (?? ->> '$.hasChartTab' = 'true' OR ?? ->> '$.hasChartTab' IS NULL)
                `,
                [
                    configType,
                    configType,
                    configType,
                    configType,
                    configType,
                    configType,
                    configType,
                ]
            )

            // CASE 3: hasMapTab=true, hasChartTab=false -> availableTabs={ WorldMap: true }
            await queryRunner.query(
                `
                -- sql
                    UPDATE chart_configs
                    SET ?? = JSON_SET(
                        ??,
                        '$.availableTabs',
                        JSON_OBJECT('WorldMap', TRUE)
                    )
                    WHERE
                        (?? ->> '$.hasMapTab' = 'true')
                        AND (?? ->> '$.hasChartTab' = 'false')
                `,
                [configType, configType, configType, configType]
            )

            // CASE 4: hasMapTab=true, hasChartTab=true -> availableTabs={ WorldMap: true, [chartType]: true }
            await queryRunner.query(
                `
                -- sql
                    UPDATE chart_configs
                    SET ?? = JSON_SET(
                        ??,
                        '$.availableTabs',
                        JSON_OBJECT(
                            'WorldMap', TRUE,
                            COALESCE(?? ->> '$.type', 'LineChart'), TRUE
                        )
                    )
                    WHERE
                        (?? ->> '$.hasMapTab' = 'true')
                        AND (?? ->> '$.hasChartTab' = 'true' OR ?? ->> '$.hasChartTab' IS NULL)
                `,
                [
                    configType,
                    configType,
                    configType,
                    configType,
                    configType,
                    configType,
                ]
            )
        }
    }

    private async updateTabField(queryRunner: QueryRunner): Promise<void> {
        // CASES:
        // 1. tab=map -> tab=WorldMap
        // 2. tab=table -> tab=Table
        // 3. tab=chart -> tab=LineChart/SlopeChart/ScatterPlot/etc.

        for (const configType of ["patch", "full"]) {
            // CASE 1: tab=map -> tab=WorldMap
            await queryRunner.query(
                `
                -- sql
                    UPDATE chart_configs
                    SET ?? = JSON_SET(??, '$.tab', 'WorldMap')
                    WHERE ?? ->> '$.tab' = 'map'
                `,
                [configType, configType, configType]
            )

            // CASE 2: tab=table -> tab=Table
            await queryRunner.query(
                `
                -- sql
                    UPDATE chart_configs
                    SET ?? = JSON_SET(??, '$.tab', 'Table')
                    WHERE ?? ->> '$.tab' = 'table'
                `,
                [configType, configType, configType]
            )

            // CASE 3: tab=chart -> tab=LineChart/SlopeChart/ScatterPlot/etc.
            await queryRunner.query(
                `
                -- sql
                    UPDATE chart_configs
                    SET ?? = JSON_SET(??, '$.tab', COALESCE(?? ->> '$.type', 'LineChart'))
                    WHERE ?? ->> '$.tab' = 'chart'
                `,
                [configType, configType, configType, configType]
            )
        }
    }

    private async removeTypeHasMapTabAndHasChartTabFields(
        queryRunner: QueryRunner
    ): Promise<void> {
        await queryRunner.query(`
            -- sql
            UPDATE chart_configs
            SET patch = JSON_REMOVE(patch, '$.type', '$.hasChartTab', '$.hasMapTab')
        `)
    }

    private async addDerivedChartTypeColumn(
        queryRunner: QueryRunner
    ): Promise<void> {
        // TODO: not future-proof
        await queryRunner.query(
            `-- sql
                ALTER TABLE chart_configs
                    ADD COLUMN chartType VARCHAR(255) GENERATED ALWAYS AS
                        (
                            CASE
                                WHEN full ->> '$.availableTabs' IS NULL OR JSON_LENGTH(full, '$.availableTabs') = 0 THEN NULL
                                -- Graphers with a line and a slope chart are considered to be of type LineChart
                                WHEN full ->> '$.availableTabs.LineChart' = 'true' THEN 'LineChart'
                                WHEN full ->> '$.availableTabs.SlopeChart' = 'true' THEN 'SlopeChart'
                                WHEN full ->> '$.availableTabs.ScatterPlot' = 'true' THEN 'ScatterPlot'
                                WHEN full ->> '$.availableTabs.StackedArea' = 'true' THEN 'StackedArea'
                                WHEN full ->> '$.availableTabs.StackedBar' = 'true' THEN 'StackedBar'
                                WHEN full ->> '$.availableTabs.ScatterPlot' = 'true' THEN 'ScatterPlot'
                                WHEN full ->> '$.availableTabs.DiscreteBar' = 'true' THEN 'DiscreteBar'
                                WHEN full ->> '$.availableTabs.StackedDiscreteBar' = 'true' THEN 'StackedDiscreteBar'
                                WHEN full ->> '$.availableTabs.Marimekko' = 'true' THEN 'Marimekko'
                                ELSE NULL
                            END
                        )
                        VIRTUAL AFTER slug;
        `
        )
    }

    public async removeDerivedTypeColumn(
        queryRunner: QueryRunner
    ): Promise<void> {
        await queryRunner.query(
            `-- sql
                ALTER TABLE chart_configs
                DROP COLUMN type;
            `
        )
    }

    public async up(queryRunner: QueryRunner): Promise<void> {
        await this.addAvailableTabsToGrapherConfigs(queryRunner)
        await this.updateTabField(queryRunner)
        await this.removeTypeHasMapTabAndHasChartTabFields(queryRunner)
        await this.addDerivedChartTypeColumn(queryRunner)
        await this.updateSchema(
            queryRunner,
            "https://files.ourworldindata.org/schemas/grapher-schema.007.json"
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // TODO: implement down migration
    }
}
