import { MigrationInterface, QueryRunner } from "typeorm"

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
    binStepSize?: number
}

type OldChartConfig = {
    type: "ScatterPlot" | "SlopeChart" | "StackedBar"
    customColors?: { [key: string]: string | undefined }
    baseColorScheme?: string
    invertColorScheme?: true
}

type NewChartConfig = OldChartConfig & {
    colorScale: ColorScaleConfig
}

function injectColorScheme(oldConfig: OldChartConfig): NewChartConfig {
    const {
        baseColorScheme,
        customColors,
        invertColorScheme,
        ...rest
    } = oldConfig
    return {
        ...rest,
        colorScale: {
            baseColorScheme: baseColorScheme,
            colorSchemeValues: [],
            colorSchemeLabels: [],
            customNumericColors: [],
            customCategoryColors: customColors ?? {},
            customCategoryLabels: {},
            customHiddenCategories: {},
            colorSchemeInvert: invertColorScheme,
            isManualBuckets: customColors ? true : undefined,
            customColorsActive: customColors ? true : undefined
        }
    }
}

function dropColorScheme(newConfig: NewChartConfig): OldChartConfig {
    const { colorScale, ...rest } = newConfig
    return {
        ...rest,
        baseColorScheme: colorScale.baseColorScheme,
        customColors: colorScale.customCategoryColors,
        invertColorScheme: colorScale.colorSchemeInvert
    }
}

async function transformScatterPlotCharts(
    queryRunner: QueryRunner,
    getNewConfig: (oldConfig: any) => any
) {
    const charts = (await queryRunner.query(`
        SELECT
            charts.id AS id,
            charts.config AS config
        FROM charts
        WHERE
            charts.config->>"$.type" IN ("ScatterPlot", "SlopeChart", "StackedBar")
    `)) as { id: number; config: string }[]
    const toUpdate: { id: number; config: string }[] = []
    for (const chart of charts) {
        const oldConfig = JSON.parse(chart.config)
        const newConfig = getNewConfig(oldConfig)
        if (JSON.stringify(oldConfig) !== JSON.stringify(newConfig)) {
            toUpdate.push({ id: chart.id, config: chart.config })
            await queryRunner.query(
                "UPDATE charts SET config = ? WHERE id = ?",
                [JSON.stringify(newConfig), chart.id]
            )
        }
    }
}

export class NewChartColorScale1591128415343 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await transformScatterPlotCharts(queryRunner, injectColorScheme)
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await transformScatterPlotCharts(queryRunner, dropColorScheme)
    }
}
