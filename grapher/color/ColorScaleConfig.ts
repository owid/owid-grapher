import { observable, makeObservable } from "mobx"
import { Color } from "../../coreTable/CoreTableConstants.js"
import { ColumnColorScale } from "../../coreTable/CoreColumnDef.js"
import {
    deleteRuntimeAndUnchangedProps,
    objectWithPersistablesToObject,
    Persistable,
    updatePersistables,
} from "../../clientUtils/persistable/Persistable.js"
import { extend, isEmpty, trimObject } from "../../clientUtils/Util.js"
import { ColorSchemeName } from "./ColorConstants.js"
import { BinningStrategy } from "./BinningStrategy.js"
import { NO_DATA_LABEL } from "./ColorScale.js"

export class ColorScaleConfigDefaults {
    // Color scheme
    // ============

    /** Key for a colorbrewer scheme */
    baseColorScheme?: ColorSchemeName

    /** Reverse the order of colors in the color scheme (defined by `baseColorScheme`) */
    colorSchemeInvert?: boolean = undefined

    // Numeric bins
    // ============

    /** The strategy for generating the bin boundaries */
    binningStrategy: BinningStrategy = BinningStrategy.ckmeans
    /** The *suggested* number of bins for the automatic binning algorithm */
    binningStrategyBinCount?: number

    /** The minimum bracket of the first bin */
    customNumericMinValue?: number
    /** Custom maximum brackets for each numeric bin. Only applied when strategy is `manual`. */
    customNumericValues: number[] = []
    /**
     * Custom labels for each numeric bin. Only applied when strategy is `manual`.
     * `undefined` or `null` falls back to default label.
     * We need to handle `null` because JSON serializes `undefined` values
     * inside arrays into `null`.
     */
    customNumericLabels: (string | undefined | null)[] = []

    /** Whether `customNumericColors` are used to override the color scheme. */
    customNumericColorsActive?: boolean = undefined
    /**
     * Override some or all colors for the numerical color legend.
     * `undefined` or `null` falls back the color scheme color.
     * We need to handle `null` because JSON serializes `undefined` values
     * inside arrays into `null`.
     */
    customNumericColors: (Color | undefined | null)[] = []

    /** Whether the visual scaling for the color legend is disabled. */
    equalSizeBins?: boolean = true

    // Categorical bins
    // ================

    customCategoryColors: {
        [key: string]: string | undefined
    } = {}

    customCategoryLabels: {
        [key: string]: string | undefined
    } = {}

    // Allow hiding categories from the legend
    customHiddenCategories: {
        [key: string]: true | undefined
    } = {}

    // Other
    // =====

    /** A custom legend description. Only used in ScatterPlot legend titles for now. */
    legendDescription?: string = undefined

    constructor() {
        makeObservable(this, {
            baseColorScheme: observable,
            colorSchemeInvert: observable,
            binningStrategy: observable,
            binningStrategyBinCount: observable,
            customNumericMinValue: observable,
            customNumericValues: observable,
            customNumericLabels: observable,
            customNumericColorsActive: observable,
            customNumericColors: observable,
            equalSizeBins: observable,
            customCategoryColors: observable.ref,
            customCategoryLabels: observable.ref,
            customHiddenCategories: observable.ref,
            legendDescription: observable,
        })
    }
}

export type ColorScaleConfigInterface = ColorScaleConfigDefaults

export class ColorScaleConfig
    extends ColorScaleConfigDefaults
    implements Persistable
{
    updateFromObject(obj: Record<string, unknown>): void {
        extend(this, obj)
    }

    toObject(): ColorScaleConfigInterface {
        const obj: ColorScaleConfigInterface =
            objectWithPersistablesToObject(this)
        deleteRuntimeAndUnchangedProps(obj, new ColorScaleConfigDefaults())
        return trimObject(obj)
    }

    constructor(obj?: Partial<ColorScaleConfig>) {
        super()
        updatePersistables(this, obj)
    }

    static fromDSL(scale: ColumnColorScale): ColorScaleConfig | undefined {
        const colorSchemeInvert = scale.colorScaleInvert
        const baseColorScheme = scale.colorScaleScheme as ColorSchemeName

        const customNumericValues: number[] = []
        const customNumericLabels: (string | undefined)[] = []
        const customNumericColors: (Color | undefined)[] = []
        scale.colorScaleNumericBins
            ?.split(INTER_BIN_DELIMITER)
            .forEach((bin): void => {
                const [value, color, ...label] = bin.split(
                    INTRA_BIN_DELIMITER
                ) as (string | undefined)[]
                if (!value) return
                customNumericValues.push(parseFloat(value))
                customNumericColors.push(color?.trim() || undefined)
                customNumericLabels.push(
                    label.join(INTRA_BIN_DELIMITER).trim() || undefined
                )
            })

        // TODO: once Grammar#parse() is called for all values, we can remove parseFloat() here
        // See issue: https://www.notion.so/owid/ColumnGrammar-parse-function-does-not-get-applied-67b578b8af7642c5859a1db79c8d5712
        const customNumericMinValue = scale.colorScaleNumericMinValue
            ? parseFloat(scale.colorScaleNumericMinValue as any)
            : undefined

        const customNumericColorsActive =
            customNumericColors.length > 0 ? true : undefined

        const customCategoryColors: {
            [key: string]: string | undefined
        } = {}
        const customCategoryLabels: {
            [key: string]: string | undefined
        } = {}
        scale.colorScaleCategoricalBins
            ?.split(INTER_BIN_DELIMITER)
            .forEach((bin): void => {
                const [value, color, ...label] = bin.split(
                    INTRA_BIN_DELIMITER
                ) as (string | undefined)[]
                if (!value) return
                customCategoryColors[value] = color?.trim() || undefined
                customCategoryLabels[value] =
                    label.join(INTRA_BIN_DELIMITER).trim() || undefined
            })
        if (scale.colorScaleNoDataLabel) {
            customCategoryLabels[NO_DATA_LABEL] = scale.colorScaleNoDataLabel
        }

        // Use user-defined binning strategy, otherwise set to manual if user has
        // defined custom bins
        const binningStrategy = scale.colorScaleBinningStrategy
            ? (scale.colorScaleBinningStrategy as BinningStrategy)
            : scale.colorScaleNumericBins || scale.colorScaleCategoricalBins
            ? BinningStrategy.manual
            : undefined

        const equalSizeBins = scale.colorScaleEqualSizeBins

        const legendDescription = scale.colorScaleLegendDescription

        const trimmed: Partial<ColorScaleConfig> = trimObject({
            colorSchemeInvert,
            baseColorScheme,
            binningStrategy,
            customNumericValues,
            customNumericColors,
            customNumericColorsActive,
            customNumericLabels,
            customNumericMinValue,
            customCategoryLabels,
            customCategoryColors,
            equalSizeBins,
            legendDescription,
        })

        return isEmpty(trimmed) ? undefined : new ColorScaleConfig(trimmed)
    }

    toDSL(): ColumnColorScale {
        const {
            colorSchemeInvert,
            baseColorScheme,
            binningStrategy,
            customNumericValues,
            customNumericColors,
            customNumericLabels,
            customNumericMinValue,
            customCategoryLabels,
            customCategoryColors,
            equalSizeBins,
            legendDescription,
        } = this.toObject()

        const columnColorScale: ColumnColorScale = {
            colorScaleScheme: baseColorScheme,
            colorScaleInvert: colorSchemeInvert,
            colorScaleBinningStrategy: binningStrategy,
            colorScaleEqualSizeBins: equalSizeBins,
            colorScaleLegendDescription: legendDescription,
            colorScaleNumericMinValue: customNumericMinValue,
            colorScaleNumericBins: (customNumericValues ?? [])
                .map((value: any, index: number) =>
                    [
                        value,
                        customNumericColors[index] ?? "",
                        customNumericLabels[index],
                    ].join(INTRA_BIN_DELIMITER)
                )
                .join(INTER_BIN_DELIMITER),
            colorScaleNoDataLabel: customCategoryLabels[NO_DATA_LABEL],
            colorScaleCategoricalBins: Object.keys(customCategoryColors ?? {})
                .map((value) =>
                    [
                        value,
                        customCategoryColors[value],
                        customCategoryLabels[value],
                    ].join(INTRA_BIN_DELIMITER)
                )
                .join(INTER_BIN_DELIMITER),
        }

        return trimObject(columnColorScale)
    }
}

const INTER_BIN_DELIMITER = ";"
const INTRA_BIN_DELIMITER = ","
