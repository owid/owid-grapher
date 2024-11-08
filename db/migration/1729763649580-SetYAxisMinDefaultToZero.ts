import { mergeGrapherConfigs } from "@ourworldindata/utils"
import { MigrationInterface, QueryRunner } from "typeorm"

export class SetYAxisMinDefaultToZero1729763649580
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        // charts with inheritance disabled:
        // set yAxis.min explicitly to "auto" for line charts
        // that used to rely on "auto" being the default.
        await queryRunner.query(`
            -- sql
            UPDATE chart_configs cc
            JOIN charts c ON cc.id = c.configId
            SET
                -- using JSON_MERGE_PATCH instead of JSON_SET in case yAxis doesn't exist
                cc.patch = JSON_MERGE_PATCH(cc.patch, '{"yAxis":{"min":"auto"}}')
            WHERE
                cc.full ->> '$.type' = 'LineChart'
                AND c.isInheritanceEnabled IS FALSE
                AND cc.patch ->> '$.yAxis.min' IS NULL
        `)

        // charts with inheritance enabled:
        // set yAxis.min explicitly to "auto" for line charts
        // that used to rely on "auto" being the default.
        // this is the case for charts where neither the patch config
        // of the chart itself nor the indicator config have yAxis.min set
        await queryRunner.query(`
            -- sql
            UPDATE chart_configs cc
            JOIN charts c ON cc.id = c.configId
            -- keep charts without parent indicator
            LEFT JOIN charts_x_parents cxp ON cxp.chartId = c.id
            LEFT JOIN variables v ON v.id = cxp.variableId
            LEFT JOIN chart_configs cc_admin ON cc_admin.id = v.grapherConfigIdAdmin
            SET
                -- using JSON_MERGE_PATCH instead of JSON_SET in case yAxis doesn't exist
                cc.patch = JSON_MERGE_PATCH(cc.patch, '{"yAxis":{"min":"auto"}}')
            WHERE
                cc.full ->> '$.type' = 'LineChart'
                AND c.isInheritanceEnabled IS TRUE
                AND cc.patch ->> '$.yAxis.min' IS NULL
                AND (
                    cc_admin.full IS NULL
                    OR cc_admin.full ->> '$.yAxis.min' IS NULL
                )
        `)

        // recompute all full configs (we need to update all charts
        // since the defaultGrapherConfig has changed)
        const charts = await queryRunner.query(`
             -- sql
             SELECT
                 cc.id AS configId,
                 cc.patch AS patchConfig,
                 cc_etl.patch AS etlConfig,
                 cc_admin.patch AS adminConfig,
                 c.isInheritanceEnabled
             FROM charts c
             JOIN chart_configs cc ON cc.id = c.configId
             LEFT JOIN charts_x_parents cxp ON cxp.chartId = c.id
             LEFT JOIN variables v ON v.id = cxp.variableId
             LEFT JOIN chart_configs cc_etl ON cc_etl.id = v.grapherConfigIdETL
             LEFT JOIN chart_configs cc_admin ON cc_admin.id = v.grapherConfigIdAdmin
         `)
        for (const chart of charts) {
            const patchConfig = JSON.parse(chart.patchConfig)

            const etlConfig = chart.etlConfig
                ? JSON.parse(chart.etlConfig)
                : undefined
            const adminConfig = chart.adminConfig
                ? JSON.parse(chart.adminConfig)
                : undefined

            const fullConfig = mergeGrapherConfigs(
                defaultGrapherConfig as any,
                chart.isInheritanceEnabled ? etlConfig ?? {} : {},
                chart.isInheritanceEnabled ? adminConfig ?? {} : {},
                patchConfig
            )

            await queryRunner.query(
                `
                    -- sql
                    UPDATE chart_configs cc
                    SET cc.full = ?
                    WHERE cc.id = ?
                `,
                [JSON.stringify(fullConfig), chart.configId]
            )
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    public async down(): Promise<void> {}
}

const defaultGrapherConfig = {
    $schema: "https://files.ourworldindata.org/schemas/grapher-schema.005.json",
    map: {
        projection: "World",
        hideTimeline: false,
        colorScale: {
            equalSizeBins: true,
            binningStrategy: "ckmeans",
            customNumericColorsActive: false,
            colorSchemeInvert: false,
            binningStrategyBinCount: 5,
        },
        toleranceStrategy: "closest",
        tooltipUseCustomLabels: false,
        time: "latest",
    },
    maxTime: "latest",
    yAxis: {
        removePointsOutsideDomain: false,
        scaleType: "linear",
        max: "auto",
        canChangeScaleType: false,
        facetDomain: "shared",
    },
    tab: "chart",
    matchingEntitiesOnly: false,
    hasChartTab: true,
    hideLegend: false,
    hideLogo: false,
    timelineMinTime: "earliest",
    hideTimeline: false,
    colorScale: {
        equalSizeBins: true,
        binningStrategy: "ckmeans",
        customNumericColorsActive: false,
        colorSchemeInvert: false,
        binningStrategyBinCount: 5,
    },
    scatterPointLabelStrategy: "year",
    selectedFacetStrategy: "none",
    invertColorScheme: false,
    hideRelativeToggle: true,
    logo: "owid",
    entityType: "country or region",
    facettingLabelByYVariables: "metric",
    addCountryMode: "add-country",
    compareEndPointsOnly: false,
    type: "LineChart",
    hasMapTab: false,
    stackMode: "absolute",
    minTime: "earliest",
    hideAnnotationFieldsInTitle: {
        entity: false,
        time: false,
        changeInPrefix: false,
    },
    xAxis: {
        removePointsOutsideDomain: false,
        scaleType: "linear",
        max: "auto",
        canChangeScaleType: false,
        facetDomain: "shared",
    },
    timelineMaxTime: "latest",
    hideConnectedScatterLines: false,
    showNoDataArea: true,
    zoomToSelection: false,
    showYearLabels: false,
    hideTotalValueLabel: false,
    hideScatterLabels: false,
    sortBy: "total",
    sortOrder: "desc",
    hideFacetControl: true,
    entityTypePlural: "countries and regions",
    missingDataStrategy: "auto",
}
