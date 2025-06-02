import * as _ from "lodash-es"
import { computed, toJS, makeObservable } from "mobx"
import { mean, deviation, quantile } from "d3-array"
import { ColorScaleConfig } from "./ColorScaleConfig"
import {
    roundSigFig,
    mapNullToUndefined,
    sortNumeric,
    pairs,
} from "@ourworldindata/utils"
import { ColorSchemes } from "../color/ColorSchemes"
import { ColorScheme } from "../color/ColorScheme"
import { ColorScaleBin, NumericBin, CategoricalBin } from "./ColorScaleBin"
import { OWID_NO_DATA_GRAY } from "./ColorConstants"
import { getBinMaximums } from "./BinningStrategies"
import {
    ColorScaleConfigInterface,
    ColorSchemeName,
    BinningStrategy,
    Color,
    CoreValueType,
    OwidVariableRoundingMode,
} from "@ourworldindata/types"
import { CoreColumn } from "@ourworldindata/core-table"
import * as R from "remeda"
import {
    autoChooseLogBins,
    equalSizeBins,
    equalSizeBinsWithMidpoint,
    runBinningStrategy,
} from "./BinningStrategies2.js"

export const NO_DATA_LABEL = "No data"
export const PROJECTED_DATA_LABEL = "Projected data"

export interface ColorScaleManager {
    colorScaleConfig?: ColorScaleConfigInterface
    hasNoDataBin?: boolean
    hasProjectedDataBin?: boolean
    defaultNoDataColor?: string
    defaultBaseColorScheme?: ColorSchemeName
    colorScaleColumn?: CoreColumn
}

export class ColorScale {
    private manager: Readonly<ColorScaleManager>
    constructor(manager: ColorScaleManager = {}) {
        makeObservable(this)
        this.manager = manager
    }

    // Config accessors

    @computed get config(): ColorScaleConfigInterface {
        return this.manager.colorScaleConfig
            ? this.manager.colorScaleConfig
            : new ColorScaleConfig()
    }

    @computed get customNumericValues(): number[] {
        return this.config.customNumericValues ?? []
    }

    @computed get customNumericColorsActive(): boolean {
        return this.config.customNumericColorsActive ?? false
    }

    @computed get customNumericColors(): (Color | undefined)[] {
        const colors = this.customNumericColorsActive
            ? mapNullToUndefined(this.config.customNumericColors)
            : []
        return colors
    }

    @computed get customHiddenCategories(): {
        [key: string]: true | undefined
    } {
        return this.config.customHiddenCategories ?? {}
    }

    @computed get customNumericLabels(): (string | undefined)[] {
        if (!this.isManualBuckets) return []

        const labels =
            mapNullToUndefined(toJS(this.config.customNumericLabels)) || []
        while (labels.length < this.numNumericBins) labels.push(undefined)
        return labels
    }

    @computed get isColorSchemeInverted(): boolean {
        return this.config.colorSchemeInvert ?? false
    }

    @computed private get customCategoryLabels(): {
        [key: string]: string | undefined
    } {
        return this.config.customCategoryLabels ?? {}
    }

    @computed get baseColorScheme(): ColorSchemeName {
        return (
            this.config.baseColorScheme ??
            this.manager.defaultBaseColorScheme ??
            ColorSchemeName.BuGn
        )
    }

    @computed private get defaultColorScheme(): ColorScheme {
        return ColorSchemes.get(ColorSchemeName.BuGn)
    }

    @computed private get defaultNoDataColor(): Color {
        return this.manager.defaultNoDataColor ?? OWID_NO_DATA_GRAY
    }

    @computed get colorScaleColumn(): CoreColumn | undefined {
        return this.manager.colorScaleColumn
    }

    @computed get legendDescription(): string | undefined {
        return this.config.legendDescription
    }

    // Transforms

    @computed private get hasNoDataBin(): boolean {
        return this.manager.hasNoDataBin || false
    }

    @computed private get hasProjectedDataBin(): boolean {
        return this.manager.hasProjectedDataBin || false
    }

    @computed get sortedNumericValues(): number[] {
        return sortNumeric(
            this.colorScaleColumn?.values.filter(R.isNumber) ?? []
        )
    }

    @computed private get minPossibleValue(): number | undefined {
        return R.first(this.sortedNumericValues)
    }

    @computed private get maxPossibleValue(): number | undefined {
        return R.last(this.sortedNumericValues)
    }

    @computed private get categoricalValues(): string[] {
        return this.colorScaleColumn?.sortedUniqNonEmptyStringVals ?? []
    }

    @computed private get colorScheme(): ColorScheme {
        return ColorSchemes.get(this.baseColorScheme) ?? this.defaultColorScheme
    }

    @computed get singleColorScale(): boolean {
        return this.colorScheme.singleColorScale
    }

    @computed get autoMinBinValue(): number {
        const minValue = Math.min(0, this.sortedNumericValuesWithoutOutliers[0])
        return isNaN(minValue) ? 0 : roundSigFig(minValue, 1)
    }

    @computed private get minBinValue(): number {
        return this.config.customNumericValues?.[0] ?? this.autoMinBinValue
    }

    @computed private get manualBinThresholds(): number[] {
        if (!this.sortedNumericValues.length || this.numNumericBins <= 0)
            return []

        return this.customNumericValues
    }

    // When automatic classification is turned on, this takes the numeric map data
    // and works out some discrete ranges to assign colors to
    @computed get autoBinMaximums(): number[] {
        return runBinningStrategy({
            strategy: "auto",
            sortedValues: this.sortedNumericValues,
            isPercent: this.colorScaleColumn?.shortUnit === "%",
            numDecimalPlaces: this.colorScaleColumn?.numDecimalPlaces,
        }).bins

        const hasNegativeValues = this.sortedNumericValues[0] < 0

        if (hasNegativeValues) {
            const lower = quantile(this.sortedNumericValues, 0.01)
            const upper = quantile(this.sortedNumericValues, 0.99)
            return equalSizeBinsWithMidpoint({
                minValue: lower ?? 1,
                maxValue: upper ?? 1,
                midpoint: 0,
            })
        }

        const positiveValues = R.dropWhile(
            this.sortedNumericValues,
            (v) => v <= 0
        )
        const quantileLower = quantile(positiveValues, 0.1)
        const quantileUpper = quantile(positiveValues, 0.995)
        const magnitudeDiff =
            Math.log10(quantileUpper) - Math.log10(quantileLower)

        console.log(quantileLower, quantileUpper, magnitudeDiff)

        if (magnitudeDiff < 1.2) {
            return equalSizeBins({
                minValue: quantileLower ?? 1,
                maxValue: quantileUpper ?? 1,
            })
        }
        return autoChooseLogBins({
            minValue: quantileLower ?? 1,
            maxValue: quantileUpper ?? 1,
        })
    }

    @computed private get bucketThresholds(): number[] {
        return this.isManualBuckets
            ? this.manualBinThresholds
            : this.autoBinThresholds
    }

    // Ensure there's always a custom color for "No data"
    @computed private get customCategoryColors(): { [key: string]: Color } {
        return {
            [NO_DATA_LABEL]: this.defaultNoDataColor, // default 'no data' color
            ...this.config.customCategoryColors,
        }
    }

    @computed get noDataColor(): Color {
        return this.customCategoryColors[NO_DATA_LABEL]
    }

    @computed get baseColors(): Color[] {
        const { categoricalValues, colorScheme, isColorSchemeInverted } = this
        const numColors = this.numNumericBins + categoricalValues.length
        const colors = colorScheme.getColors(numColors)

        if (isColorSchemeInverted) return colors.toReversed()
        else return colors
    }

    @computed get numAutoBins(): number {
        return this.config.binningStrategyBinCount ?? 5
    }

    @computed get isManualBuckets(): boolean {
        return false
    }

    @computed get numNumericBins(): number {
        if (!this.sortedNumericValues.length) return 0

        return this.isManualBuckets
            ? Math.max(this.customNumericValues.length - 1, 0)
            : this.numAutoBins
    }

    // Exclude any major outliers for legend calculation (they will be relegated to open-ended bins)
    @computed get sortedNumericValuesWithoutOutliers(): any[] {
        const { sortedNumericValues } = this
        if (!sortedNumericValues.length) return []
        const sampleMean = mean(sortedNumericValues) as number
        const sampleDeviation = deviation(sortedNumericValues) ?? 0
        const withoutOutliers = sortedNumericValues.filter(
            (d) => Math.abs(d - sampleMean) <= sampleDeviation * 3
        )

        // d3-array returns a deviation of `undefined` for arrays of length <= 1, so set it to 0 in that case
        const deviationWithoutOutliers = deviation(withoutOutliers) ?? 0

        if (deviationWithoutOutliers === 0) {
            // if after removing outliers we end up in a state where the std. dev. is 0, i.e. we only
            // have one distinct value, then we actually want to _keep_ the outliers in
            return sortedNumericValues
        } else return withoutOutliers
    }

    /** Sorted numeric values passed onto the binning algorithms */
    @computed private get sortedNumericBinningValues(): any[] {
        return this.sortedNumericValuesWithoutOutliers.filter(
            (v) => v > this.minBinValue
        )
    }

    @computed private get numericLegendBins(): NumericBin[] {
        const {
            customNumericLabels,
            minPossibleValue,
            maxPossibleValue,
            customNumericColors,
            bucketThresholds,
            baseColors,
        } = this

        if (minPossibleValue === undefined || maxPossibleValue === undefined)
            return []

        return pairs(bucketThresholds).map(([min, max], index) => {
            const baseColor = baseColors[index]
            const color = customNumericColors[index] ?? baseColor
            const label = customNumericLabels[index]

            const roundingOptions = {
                roundingMode: OwidVariableRoundingMode.decimalPlaces,
            }
            const displayMin =
                this.colorScaleColumn?.formatValueShort(min, roundingOptions) ??
                min.toString()
            const displayMax =
                this.colorScaleColumn?.formatValueShort(max, roundingOptions) ??
                max.toString()

            const isFirst = index === 0
            const isLast = index === bucketThresholds.length - 2
            return new NumericBin({
                isFirst,
                isOpenLeft: isFirst && min > minPossibleValue,
                isOpenRight: isLast && max < maxPossibleValue,
                min,
                max,
                color,
                label,
                displayMin,
                displayMax,
            })
        })
    }

    @computed get legendBins(): ColorScaleBin[] {
        // todo: turn comment into unit test
        // Will eventually produce something like this:
        // [{ min: 10, max: 20, minText: "10%", maxText: "20%", color: '#faeaef' },
        //  { min: 20, max: 30, minText: "20%", maxText: "30%", color: '#fefabc' },
        //  { value: 'Foobar', text: "Foobar Boop", color: '#bbbbbb'}]
        return [
            ...this.numericLegendBins,
            ...this.categoricalLegendBins,
        ] as ColorScaleBin[]
    }

    @computed get categoricalLegendBins(): CategoricalBin[] {
        const {
            bucketThresholds,
            baseColors,
            hasNoDataBin,
            hasProjectedDataBin,
            categoricalValues,
            customCategoryColors,
            customCategoryLabels,
            customHiddenCategories,
        } = this

        let allCategoricalValues = categoricalValues

        // Inject "No data" bin
        if (hasNoDataBin && !allCategoricalValues.includes(NO_DATA_LABEL)) {
            // The color scheme colors get applied in order, starting from first, and we only use
            // as many colors as there are categorical values (excluding "No data").
            // So in order to leave it colorless, we want to append the "No data" label last.
            // -@danielgavrilov, 2020-06-02
            allCategoricalValues = [...allCategoricalValues, NO_DATA_LABEL]
        }

        // Inject "Projected data" bin
        if (hasProjectedDataBin) {
            allCategoricalValues = [
                ...allCategoricalValues,
                PROJECTED_DATA_LABEL,
            ]
        }

        return allCategoricalValues.map((value, index) => {
            const boundingOffset = _.isEmpty(bucketThresholds)
                ? 0
                : bucketThresholds.length - 1
            const baseColor = baseColors[index + boundingOffset]
            const color = customCategoryColors[value] ?? baseColor
            const label = customCategoryLabels[value] ?? value

            return new CategoricalBin({
                index,
                value,
                color,
                label,
                isHidden: !!customHiddenCategories[value],
            })
        })
    }

    getBinForValue(
        value: CoreValueType | undefined
    ): ColorScaleBin | undefined {
        return value === undefined
            ? undefined
            : this.legendBins.find((bin) => bin.contains(value))
    }

    getColor(value: CoreValueType | undefined): string | undefined {
        if (value === undefined) return this.noDataColor
        return this.getBinForValue(value)?.color
    }
}
