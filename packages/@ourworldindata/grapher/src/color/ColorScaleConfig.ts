import * as _ from "lodash-es"
import { observable, makeObservable } from "mobx"
import {
    Color,
    ColumnColorScale,
    BinningStrategy,
    ColorSchemeName,
    ColorScaleConfigInterface,
} from "@ourworldindata/types"
import {
    trimObject,
    deleteRuntimeAndUnchangedProps,
    objectWithPersistablesToObject,
    Persistable,
    updatePersistables,
} from "@ourworldindata/utils"

import { NO_DATA_LABEL } from "./ColorScale"

export class ColorScaleConfigDefaults implements ColorScaleConfigInterface {
    // Color scheme
    // ============

    /** Key for a colorbrewer scheme */
    baseColorScheme: ColorSchemeName | undefined = undefined

    /** Reverse the order of colors in the color scheme (defined by `baseColorScheme`) */
    colorSchemeInvert: boolean | undefined = undefined

    // Numeric bins
    // ============

    /** The strategy for generating the bin boundaries */
    binningStrategy: BinningStrategy = "auto"
    createBinForMidpoint?: boolean
    minValue?: number
    maxValue?: number
    midpointMode?: string

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
    customNumericColorsActive: boolean | undefined = undefined
    /**
     * Override some or all colors for the numerical color legend.
     * `undefined` or `null` falls back the color scheme color.
     * We need to handle `null` because JSON serializes `undefined` values
     * inside arrays into `null`.
     */
    customNumericColors: (Color | undefined | null)[] = []

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
    legendDescription: string | undefined = undefined

    constructor() {
        makeObservable(this, {
            baseColorScheme: observable,
            colorSchemeInvert: observable,
            binningStrategy: observable,
            customNumericValues: observable,
            customNumericLabels: observable,
            customNumericColorsActive: observable,
            customNumericColors: observable,
            customCategoryColors: observable.ref,
            customCategoryLabels: observable.ref,
            customHiddenCategories: observable.ref,
            legendDescription: observable,
            createBinForMidpoint: observable,
            minValue: observable,
            maxValue: observable,
            midpointMode: observable,
        })
    }
}

export class ColorScaleConfig
    extends ColorScaleConfigDefaults
    implements Persistable
{
    updateFromObject(obj: Record<string, unknown>): void {
        _.extend(this, obj)
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

        if (scale.colorScaleNumericBins) {
            customNumericValues.push(scale.colorScaleNumericMinValue ?? 0)

            scale.colorScaleNumericBins
                .split(INTER_BIN_DELIMITER)
                .forEach((bin: string): void => {
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
        }

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
            .forEach((bin: string): void => {
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
              ? "manual"
              : undefined

        const legendDescription = scale.colorScaleLegendDescription

        const trimmed: Partial<ColorScaleConfig> = trimObject({
            colorSchemeInvert,
            baseColorScheme,
            binningStrategy,
            customNumericValues,
            customNumericColors,
            customNumericColorsActive,
            customNumericLabels,
            customCategoryLabels,
            customCategoryColors,
            legendDescription,
        })

        return _.isEmpty(trimmed) ? undefined : new ColorScaleConfig(trimmed)
    }
}

const INTER_BIN_DELIMITER = ";"
const INTRA_BIN_DELIMITER = ","
