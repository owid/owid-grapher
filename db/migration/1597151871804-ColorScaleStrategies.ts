import { MigrationInterface, QueryRunner } from "typeorm"

interface OldColorScaleConfig {
    baseColorScheme?: string
    colorSchemeMinValue?: number
    colorSchemeValues: number[]
    colorSchemeLabels: (string | undefined)[]
    isManualBuckets?: true
    equalSizeBins?: true
    colorSchemeInvert?: true
    customColorsActive?: true
    customNumericColors: (string | undefined)[]
    customCategoryColors: {
        [key: string]: string | undefined
    }
    customCategoryLabels: {
        [key: string]: string | undefined
    }
    customHiddenCategories: {
        [key: string]: true | undefined
    }
    legendDescription?: string
}

enum ColorScaleBinningStrategy {
    equalInterval = "equalInterval",
    manual = "manual"
}

interface NewColorScaleConfig {
    baseColorScheme?: string
    colorSchemeInvert?: true

    binningStrategy: ColorScaleBinningStrategy
    customNumericMinValue?: number
    customNumericValues: number[]
    customNumericLabels: (string | undefined)[]
    customNumericColorsActive?: true
    customNumericColors: (string | undefined)[]

    equalSizeBins?: true

    customCategoryColors: {
        [key: string]: string | undefined
    }
    customCategoryLabels: {
        [key: string]: string | undefined
    }
    customHiddenCategories: {
        [key: string]: true | undefined
    }

    legendDescription?: string
}

interface ChartConfig<ColorScaleConfig> {
    colorScale?: ColorScaleConfig
    map?: {
        colorScale: ColorScaleConfig
    }
}

type OldChartConfig = ChartConfig<OldColorScaleConfig>
type NewChartConfig = ChartConfig<NewColorScaleConfig>

function oldToNewColorScaleConfig(
    oldConfig: OldColorScaleConfig
): NewColorScaleConfig {
    return {
        baseColorScheme: oldConfig.baseColorScheme,
        colorSchemeInvert: oldConfig.colorSchemeInvert,

        binningStrategy: oldConfig.isManualBuckets
            ? ColorScaleBinningStrategy.manual
            : ColorScaleBinningStrategy.equalInterval,
        customNumericMinValue: oldConfig.colorSchemeMinValue,
        customNumericValues: oldConfig.colorSchemeValues,
        customNumericLabels: oldConfig.colorSchemeLabels,
        customNumericColorsActive: oldConfig.customColorsActive,
        customNumericColors: oldConfig.customNumericColors,

        equalSizeBins: oldConfig.equalSizeBins,

        customCategoryColors: oldConfig.customCategoryColors,
        customCategoryLabels: oldConfig.customCategoryLabels,
        customHiddenCategories: oldConfig.customHiddenCategories,

        legendDescription: oldConfig.legendDescription
    }
}

function newToOldColorScaleConfig(
    newConfig: NewColorScaleConfig
): OldColorScaleConfig {
    return {
        baseColorScheme: newConfig.baseColorScheme,
        colorSchemeInvert: newConfig.colorSchemeInvert,

        isManualBuckets:
            newConfig.binningStrategy === ColorScaleBinningStrategy.manual
                ? true
                : undefined,

        colorSchemeMinValue: newConfig.customNumericMinValue,
        colorSchemeValues: newConfig.customNumericValues,
        colorSchemeLabels: newConfig.customNumericLabels,
        customColorsActive: newConfig.customNumericColorsActive,
        customNumericColors: newConfig.customNumericColors,

        equalSizeBins: newConfig.equalSizeBins,

        customCategoryColors: newConfig.customCategoryColors,
        customCategoryLabels: newConfig.customCategoryLabels,
        customHiddenCategories: newConfig.customHiddenCategories,

        legendDescription: newConfig.legendDescription
    }
}

function transformColorScaleConfig<I, O>(
    config: ChartConfig<I>,
    transform: (_: I) => O
): ChartConfig<O> {
    return {
        ...config,
        colorScale:
            config.colorScale === undefined
                ? undefined
                : transform(config.colorScale),
        map:
            config.map === undefined
                ? undefined
                : {
                      ...config.map,
                      colorScale: transform(config.map.colorScale)
                  }
    }
}

async function transformAllCharts(
    queryRunner: QueryRunner,
    getNewConfig: (oldConfig: any) => any
) {
    await Promise.all(
        [
            { idField: "id", tableName: "charts" },
            { idField: "chartId", tableName: "chart_revisions" }
        ].map(async ({ idField, tableName }) => {
            const charts = (await queryRunner.query(`
            SELECT ${idField} AS id, config
            FROM ${tableName}
        `)) as { id: number; config: string }[]
            const toUpdate: { id: number; config: string }[] = []
            for (const chart of charts) {
                const oldConfig = JSON.parse(chart.config)
                const newConfig = getNewConfig(oldConfig)
                if (JSON.stringify(oldConfig) !== JSON.stringify(newConfig)) {
                    toUpdate.push({ id: chart.id, config: chart.config })
                    await queryRunner.query(
                        `UPDATE ${tableName} SET config = ? WHERE ${idField} = ?`,
                        [JSON.stringify(newConfig), chart.id]
                    )
                }
            }
        })
    )
}

export class ColorScaleStrategies1597151871804 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await transformAllCharts(queryRunner, (config: OldChartConfig) =>
            transformColorScaleConfig(config, oldToNewColorScaleConfig)
        )
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await transformAllCharts(queryRunner, (config: NewChartConfig) =>
            transformColorScaleConfig(config, newToOldColorScaleConfig)
        )
    }
}
