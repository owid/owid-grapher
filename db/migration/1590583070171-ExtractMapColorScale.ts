import { MigrationInterface, QueryRunner } from "typeorm"
import omit from "lodash/omit"
import clone from "lodash/clone"

type MapProjection =
    | "World"
    | "Africa"
    | "NorthAmerica"
    | "SouthAmerica"
    | "Asia"
    | "Europe"
    | "Oceania"

interface ColorScaleConfig {
    baseColorScheme?: string
    colorSchemeMinValue?: number
    colorSchemeValues: number[]
    colorSchemeLabels: (string | undefined)[]
    isManualBuckets?: true
    equalSizeBins?: true
    colorSchemeInvert?: true
    customColorsActive?: true
    customNumericColors: (string | undefined)[]
    customCategoryColors: { [key: string]: string }
    customCategoryLabels: { [key: string]: string }
    customHiddenCategories: { [key: string]: true }
    legendDescription?: string
    binStepSize?: number
}

interface MapOnlyConfig {
    variableId?: number
    targetYear?: number
    timeTolerance?: number
    hideTimeline?: true
    projection: MapProjection
    tooltipUseCustomLabels?: true
}

type OldMapConfig = ColorScaleConfig & MapOnlyConfig

type NewMapConfig = MapOnlyConfig & { colorScale: ColorScaleConfig }

function extractColorScaleConfig(
    oldConfig: OldMapConfig | undefined | null
): NewMapConfig | undefined {
    if (oldConfig === undefined || oldConfig === null) return undefined
    const {
        baseColorScheme,
        colorSchemeMinValue,
        colorSchemeValues,
        colorSchemeLabels,
        isManualBuckets,
        equalSizeBins,
        colorSchemeInvert,
        customColorsActive,
        customNumericColors,
        customCategoryColors,
        customCategoryLabels,
        customHiddenCategories,
        legendDescription,
        binStepSize,
        ...rest
    } = oldConfig
    return {
        ...rest,
        colorScale: {
            baseColorScheme,
            colorSchemeMinValue,
            colorSchemeValues,
            colorSchemeLabels,
            isManualBuckets,
            equalSizeBins,
            colorSchemeInvert,
            customColorsActive,
            customNumericColors,
            customCategoryColors,
            customCategoryLabels,
            customHiddenCategories,
            legendDescription,
            binStepSize
        }
    }
}

function mergeColorScaleConfig(
    newConfig: NewMapConfig | undefined | null
): OldMapConfig | undefined {
    if (newConfig === undefined || newConfig === null) return undefined
    const { colorScale } = newConfig
    return {
        ...omit(newConfig, "colorScale"),
        ...colorScale
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

export class ExtractMapColorScale1590583070171 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await transformAllCharts(queryRunner, oldConfig => {
            // Clone and modify in place to avoid changing order of keys
            const newConfig = clone(oldConfig)
            newConfig.map = extractColorScaleConfig(
                oldConfig.map as OldMapConfig
            )
            return newConfig
        })
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await transformAllCharts(queryRunner, newConfig => {
            // Clone and modify in place to avoid changing order of keys
            const oldConfig = clone(newConfig)
            oldConfig.map = mergeColorScaleConfig(newConfig.map as NewMapConfig)
            return oldConfig
        })
    }
}
