import { MigrationInterface, QueryRunner } from "typeorm"
import { diffGrapherConfigs, mergeGrapherConfigs } from "@ourworldindata/utils"

export class MakeChartsInheritDefaults1720600092980
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        const charts = (await queryRunner.query(
            `-- sql
                SELECT id, patch as config FROM chart_configs
            `
        )) as { id: string; config: string }[]

        for (const chart of charts) {
            const originalConfig = JSON.parse(chart.config)

            // if the schema version is missing, assume it's the latest
            if (!originalConfig.$schema) {
                originalConfig.$schema = defaultGrapherConfig.$schema
            }

            // if isPublished is missing, add it
            if (!originalConfig.isPublished) {
                originalConfig.isPublished = false
            }

            const patchConfig = diffGrapherConfigs(
                originalConfig,
                defaultGrapherConfig as any
            )
            const fullConfig = mergeGrapherConfigs(
                defaultGrapherConfig as any,
                patchConfig
            )

            await queryRunner.query(
                `-- sql
                    UPDATE chart_configs
                    SET
                        patch = ?,
                        full = ?
                    WHERE id = ?
                `,
                [
                    JSON.stringify(patchConfig),
                    JSON.stringify(fullConfig),
                    chart.id,
                ]
            )
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // we can't recover the original configs,
        // but the patched one is the next best thing
        await queryRunner.query(
            `-- sql
                UPDATE chart_configs
                SET full = patch
            `
        )
    }
}

const defaultGrapherConfig = {
    $schema: "https://files.ourworldindata.org/schemas/grapher-schema.004.json",
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
        canChangeScaleType: false,
        facetDomain: "shared",
    },
    tab: "chart",
    matchingEntitiesOnly: false,
    hasChartTab: true,
    hideLegend: false,
    hideLogo: false,
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
        canChangeScaleType: false,
        facetDomain: "shared",
    },
    hideConnectedScatterLines: false,
    showNoDataArea: true,
    zoomToSelection: false,
    showYearLabels: false,
    hideLinesOutsideTolerance: false,
    hideTotalValueLabel: false,
    hideScatterLabels: false,
    sortBy: "total",
    sortOrder: "desc",
    hideFacetControl: true,
    entityTypePlural: "countries and regions",
    missingDataStrategy: "auto",
}
