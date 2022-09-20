import { computed, toJS } from "mobx"
import { mean, deviation } from "d3-array"
import {
    ColorScaleConfig,
    ColorScaleConfigDefaults,
    ColorScaleConfigInterface,
} from "./ColorScaleConfig.js"
import {
    isEmpty,
    reverse,
    first,
    last,
    roundSigFig,
    mapNullToUndefined,
    isString,
    mapValues,
    identity,
} from "../../clientUtils/Util.js"
import { Color, CoreValueType } from "../../coreTable/CoreTableConstants.js"
import { ColorSchemes } from "../color/ColorSchemes.js"
import { ColorScheme } from "../color/ColorScheme.js"
import { ColorScaleBin, NumericBin, CategoricalBin } from "./ColorScaleBin.js"
import { ColorSchemeName, OwidNoDataGray } from "./ColorConstants.js"
import { CoreColumn } from "../../coreTable/CoreTableColumns.js"
import { getBinMaximums } from "./BinningStrategies.js"
import { BinningStrategy } from "./BinningStrategy.js"

export const NO_DATA_LABEL = "No data"

export interface ColorScaleManager {
    colorScaleConfig?: ColorScaleConfigInterface
    hasNoDataBin?: boolean
    defaultNoDataColor?: string
    defaultBaseColorScheme?: ColorSchemeName
    colorScaleColumn?: CoreColumn
    transformColor?: (color: Color) => Color
}

export class ColorScale {
    private manager: Readonly<ColorScaleManager>
    constructor(manager: ColorScaleManager = {}) {
        this.manager = manager
    }

    // Config accessors

    @computed get config(): ColorScaleConfigDefaults {
        return this.manager.colorScaleConfig ?? new ColorScaleConfig()
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
        return colors.map(this.transformColor)
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
        while (labels.length < this.numBins) labels.push(undefined)
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
        return ColorSchemes[ColorSchemeName.BuGn]
    }

    @computed private get defaultNoDataColor(): Color {
        return this.transformColor(
            this.manager.defaultNoDataColor ?? OwidNoDataGray
        )
    }

    @computed get colorScaleColumn(): CoreColumn | undefined {
        return this.manager.colorScaleColumn
    }

    @computed get legendDescription(): string | undefined {
        return this.config.legendDescription
    }

    @computed private get transformColor(): <
        MaybeColor extends Color | undefined
    >(
        color: MaybeColor
    ) => MaybeColor {
        const transform = this.manager.transformColor
        if (!transform) return identity
        return <MaybeColor extends Color | undefined>(
            color: MaybeColor
        ): MaybeColor => {
            return isString(color) && transform
                ? (transform(color) as MaybeColor)
                : color
        }
    }

    // Transforms

    @computed private get hasNoDataBin(): boolean {
        return this.manager.hasNoDataBin || false
    }

    @computed get sortedNumericValues(): any[] {
        return (
            this.colorScaleColumn?.valuesAscending?.filter(
                (x) => typeof x === "number"
            ) ?? []
        )
    }

    @computed private get minPossibleValue(): any {
        return first(this.sortedNumericValues)
    }

    @computed private get maxPossibleValue(): any {
        return last(this.sortedNumericValues)
    }

    @computed private get categoricalValues(): any[] {
        return this.colorScaleColumn?.sortedUniqNonEmptyStringVals ?? []
    }

    @computed private get colorScheme(): ColorScheme {
        return ColorSchemes[this.baseColorScheme] ?? this.defaultColorScheme
    }

    @computed get singleColorScale(): boolean {
        return this.colorScheme.singleColorScale
    }

    @computed get autoMinBinValue(): number {
        const minValue = Math.min(0, this.sortedNumericValuesWithoutOutliers[0])
        return isNaN(minValue) ? 0 : roundSigFig(minValue, 1)
    }

    @computed private get minBinValue(): number {
        return this.config.customNumericMinValue ?? this.autoMinBinValue
    }

    @computed private get manualBinMaximums(): number[] {
        if (!this.sortedNumericValues.length || this.numBins <= 0) return []

        const { numBins, customNumericValues } = this

        let values = [...customNumericValues]
        while (values.length < numBins) values.push(0)
        while (values.length > numBins) values = values.slice(0, numBins)
        return values
    }

    // When automatic classification is turned on, this takes the numeric map data
    // and works out some discrete ranges to assign colors to
    @computed get autoBinMaximums(): number[] {
        return getBinMaximums({
            binningStrategy: this.config.binningStrategy,
            sortedValues: this.sortedNumericBinningValues,
            binCount: this.numAutoBins,
            minBinValue: this.minBinValue,
        })
    }

    @computed private get bucketMaximums(): number[] {
        return this.isManualBuckets
            ? this.manualBinMaximums
            : this.autoBinMaximums
    }

    // Ensure there's always a custom color for "No data"
    @computed private get customCategoryColors(): { [key: string]: Color } {
        return mapValues(
            {
                [NO_DATA_LABEL]: this.defaultNoDataColor, // default 'no data' color
                ...this.config.customCategoryColors,
            },
            this.transformColor
        )
    }

    @computed get noDataColor(): Color {
        return this.transformColor(this.customCategoryColors[NO_DATA_LABEL])
    }

    @computed get baseColors(): Color[] {
        const {
            categoricalValues,
            colorScheme,
            bucketMaximums,
            isColorSchemeInverted,
            transformColor,
        } = this
        const numColors = bucketMaximums.length + categoricalValues.length
        const colors = colorScheme.getColors(numColors)

        if (isColorSchemeInverted) reverse(colors)

        return colors.map(transformColor)
    }

    @computed get numAutoBins(): number {
        return this.config.binningStrategyBinCount ?? 5
    }

    @computed get isManualBuckets(): boolean {
        return this.config.binningStrategy === BinningStrategy.manual
    }

    @computed get numBins(): number {
        return this.isManualBuckets
            ? this.customNumericValues.length
            : this.numAutoBins
    }

    // Exclude any major outliers for legend calculation (they will be relegated to open-ended bins)
    @computed get sortedNumericValuesWithoutOutliers(): any[] {
        const { sortedNumericValues } = this
        if (!sortedNumericValues.length) return []
        const sampleMean = mean(sortedNumericValues) as number
        const sampleDeviation = deviation(sortedNumericValues) ?? 0
        const withoutOutliers = sortedNumericValues.filter(
            (d) => Math.abs(d - sampleMean) <= sampleDeviation * 2
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
            minBinValue,
            minPossibleValue,
            maxPossibleValue,
            customNumericColors,
            bucketMaximums,
            baseColors,
        } = this

        if (minPossibleValue === undefined || maxPossibleValue === undefined)
            return []

        let min = minBinValue

        return bucketMaximums.map((max, index) => {
            const baseColor = baseColors[index]
            const color = customNumericColors[index] ?? baseColor
            const label = customNumericLabels[index]

            const displayMin =
                this.colorScaleColumn?.formatValueShort(min) ?? min.toString()
            const displayMax =
                this.colorScaleColumn?.formatValueShort(max) ?? max.toString()

            const currentMin = min
            const isFirst = index === 0
            const isLast = index === bucketMaximums.length - 1
            min = max
            return new NumericBin({
                isFirst,
                isOpenLeft: isFirst && currentMin > minPossibleValue,
                isOpenRight: isLast && max < maxPossibleValue,
                min: currentMin,
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
            bucketMaximums,
            baseColors,
            hasNoDataBin,
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

        return allCategoricalValues.map((value, index) => {
            const boundingOffset = isEmpty(bucketMaximums)
                ? 0
                : bucketMaximums.length - 1
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
