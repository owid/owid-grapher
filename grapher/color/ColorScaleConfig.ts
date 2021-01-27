import { observable } from "mobx"
import { Color } from "../../coreTable/CoreTableConstants"
import { ColumnColorScale } from "../../coreTable/CoreColumnDef"
import {
    deleteRuntimeAndUnchangedProps,
    objectWithPersistablesToObject,
    Persistable,
    updatePersistables,
} from "../persistable/Persistable"
import { extend, isEmpty, trimObject } from "../../clientUtils/Util"
import { ColorSchemeName } from "./ColorConstants"
import { BinningStrategy } from "./BinningStrategy"
import { NO_DATA_LABEL } from "./ColorScale"

export class ColorScaleConfigDefaults {
    // Color scheme
    // ============

    /** Key for a colorbrewer scheme */
    @observable baseColorScheme?: ColorSchemeName

    /** Reverse the order of colors in the color scheme (defined by `baseColorScheme`) */
    @observable colorSchemeInvert?: boolean = undefined

    // Numeric bins
    // ============

    /** The strategy for generating the bin boundaries */
    @observable binningStrategy: BinningStrategy = BinningStrategy.ckmeans
    /** The *suggested* number of bins for the automatic binning algorithm */
    @observable binningStrategyBinCount?: number

    /** The minimum bracket of the first bin */
    @observable customNumericMinValue?: number
    /** Custom maximum brackets for each numeric bin. Only applied when strategy is `manual`. */
    @observable customNumericValues: number[] = []
    /**
     * Custom labels for each numeric bin. Only applied when strategy is `manual`.
     * `undefined` or `null` falls back to default label.
     * We need to handle `null` because JSON serializes `undefined` values
     * inside arrays into `null`.
     */
    @observable customNumericLabels: (string | undefined | null)[] = []

    /** Whether `customNumericColors` are used to override the color scheme. */
    @observable customNumericColorsActive?: boolean = undefined
    /**
     * Override some or all colors for the numerical color legend.
     * `undefined` or `null` falls back the color scheme color.
     * We need to handle `null` because JSON serializes `undefined` values
     * inside arrays into `null`.
     */
    @observable customNumericColors: (Color | undefined | null)[] = []

    /** Whether the visual scaling for the color legend is disabled. */
    @observable equalSizeBins?: boolean = undefined

    // Categorical bins
    // ================

    @observable.ref customCategoryColors: {
        [key: string]: string | undefined
    } = {}

    @observable.ref customCategoryLabels: {
        [key: string]: string | undefined
    } = {}

    // Allow hiding categories from the legend
    @observable.ref customHiddenCategories: {
        [key: string]: true | undefined
    } = {}

    // Other
    // =====

    /** A custom legend description. Only used in ScatterPlot legend titles for now. */
    @observable legendDescription?: string = undefined
}

export type ColorScaleConfigInterface = ColorScaleConfigDefaults

export class ColorScaleConfig
    extends ColorScaleConfigDefaults
    implements Persistable {
    updateFromObject(obj: any) {
        extend(this, obj)
    }

    toObject(): ColorScaleConfigInterface {
        const obj: ColorScaleConfigInterface = objectWithPersistablesToObject(
            this
        )
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
        scale.colorScaleNumericBins?.split(INTER_BIN_DELIMITER).map((bin) => {
            const [value, color, ...label] = bin.split(INTRA_BIN_DELIMITER)
            customNumericValues.push(parseFloat(value))
            customNumericColors.push(color || undefined)
            customNumericLabels.push(
                label.join(INTRA_BIN_DELIMITER) || undefined
            )
        })

        // TODO: once Grammar#parse() is called for all values, we can remove parseFloat() here
        // See issue: https://www.notion.so/owid/ColumnGrammar-parse-function-does-not-get-applied-67b578b8af7642c5859a1db79c8d5712
        const customNumericMinValue = scale.colorScaleNumericMinValue
            ? parseFloat(scale.colorScaleNumericMinValue as any)
            : undefined

        const customNumericColorsActive = customNumericColors.length > 0

        const customCategoryColors: {
            [key: string]: string | undefined
        } = {}
        const customCategoryLabels: {
            [key: string]: string | undefined
        } = {}
        scale.colorScaleCategoricalBins
            ?.split(INTER_BIN_DELIMITER)
            .map((bin) => {
                const [value, color, ...label] = bin.split(INTRA_BIN_DELIMITER)
                customCategoryColors[value] = color || undefined
                customCategoryLabels[value] =
                    label.join(INTRA_BIN_DELIMITER) || undefined
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
