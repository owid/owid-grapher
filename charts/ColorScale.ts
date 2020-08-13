import { computed, toJS } from "mobx"
import { mean, deviation } from "d3-array"
import { bind } from "decko"

import {
    ColorScaleConfigProps,
    ColorScaleBinningStrategy
} from "./ColorScaleConfig"
import {
    defaultTo,
    isEmpty,
    reverse,
    round,
    toArray,
    first,
    last,
    find,
    identity,
    roundSigFig
} from "./Util"
import { Color } from "./Color"
import { ColorScheme, ColorSchemes } from "./ColorSchemes"
import { ColorScaleBin, NumericBin, CategoricalBin } from "./ColorScaleBin"

const NO_DATA_LABEL = "No data"

export interface ColorScaleProps {
    config: ColorScaleConfigProps
    sortedNumericValues: number[]
    categoricalValues: string[]
    hasNoDataBin: boolean
    defaultNoDataColor?: string
    defaultBaseColorScheme?: string
    formatNumericValue?: (v: number) => string
    formatCategoricalValue?: (v: string) => string
}

export class ColorScale {
    private props: Readonly<ColorScaleProps>
    constructor(props: ColorScaleProps) {
        this.props = props
    }

    // Config accessors

    @computed get config() {
        return this.props.config
    }

    @computed get customNumericValues(): number[] {
        return defaultTo(this.config.customNumericValues, [])
    }

    @computed get customNumericColorsActive() {
        return defaultTo(this.config.customNumericColorsActive, false)
    }

    @computed get customNumericColors() {
        return defaultTo(
            this.customNumericColorsActive
                ? this.config.customNumericColors
                : [],
            []
        )
    }

    @computed get customHiddenCategories(): {
        [key: string]: true | undefined
    } {
        return defaultTo(this.config.customHiddenCategories, {})
    }

    @computed get customNumericLabels() {
        const labels = toJS(this.config.customNumericLabels) || []
        while (labels.length < this.numBins) labels.push(undefined)
        return labels
    }

    @computed get isColorSchemeInverted() {
        return defaultTo(this.config.colorSchemeInvert, false)
    }

    @computed get customCategoryLabels(): {
        [key: string]: string | undefined
    } {
        return defaultTo(this.config.customCategoryLabels, {})
    }

    @computed get baseColorScheme() {
        return defaultTo(
            this.config.baseColorScheme,
            defaultTo(this.props.defaultBaseColorScheme, "BuGn")
        )
    }

    @computed get defaultColorScheme(): ColorScheme {
        return ColorSchemes["BuGn"]!
    }

    @computed get defaultNoDataColor(): string {
        return defaultTo(this.props.defaultNoDataColor, "#eee")
    }

    @computed get formatNumericValue(): (v: number) => string {
        return defaultTo(this.props.formatNumericValue, identity)
    }

    @computed get formatCategoricalValue(): (v: string) => string {
        return defaultTo(this.props.formatCategoricalValue, identity)
    }

    @computed get legendDescription(): string | undefined {
        return this.config.legendDescription
    }

    // Transforms

    @computed get hasNoDataBin(): boolean {
        return this.props.hasNoDataBin
    }

    @computed get sortedNumericValues(): number[] {
        return this.props.sortedNumericValues
    }

    @computed get minPossibleValue(): number | undefined {
        return first(this.sortedNumericValues)
    }

    @computed get maxPossibleValue(): number | undefined {
        return last(this.sortedNumericValues)
    }

    @computed get categoricalValues(): string[] {
        return this.props.categoricalValues
    }

    @computed get colorScheme(): ColorScheme {
        return ColorSchemes[this.baseColorScheme] ?? this.defaultColorScheme
    }

    @computed get singleColorScale(): boolean {
        return this.colorScheme.singleColorScale
    }

    @computed get autoMinBinValue(): number {
        const minValue = Math.min(0, this.valuesWithoutOutliers[0])
        return Math.min(0, roundSigFig(minValue, 1))
    }

    @computed get minBinValue(): number {
        return this.config.customNumericMinValue ?? this.autoMinBinValue
    }

    @computed get manualBinMaximums(): number[] {
        if (!this.sortedNumericValues.length || this.numBins <= 0) return []

        const { numBins, customNumericValues } = this

        let values = toArray(customNumericValues)
        while (values.length < numBins) values.push(0)
        while (values.length > numBins) values = values.slice(0, numBins)
        return values as number[]
    }

    // When automatic classification is turned on, this takes the numeric map data
    // and works out some discrete ranges to assign colors to
    @computed get autoBinMaximums(): number[] {
        if (!this.sortedNumericValues.length || this.numAutoBins <= 0) return []

        const { binStepSize, numAutoBins, minBinValue } = this

        const bucketMaximums = []
        let nextMaximum = minBinValue + binStepSize
        for (let i = 0; i < numAutoBins; i++) {
            bucketMaximums.push(nextMaximum)
            nextMaximum += binStepSize
        }

        return bucketMaximums
    }

    @computed get bucketMaximums(): number[] {
        if (this.isManualBuckets) return this.manualBinMaximums
        else return this.autoBinMaximums
    }

    // Ensure there's always a custom color for "No data"
    @computed get customCategoryColors(): { [key: string]: Color } {
        return {
            [NO_DATA_LABEL]: this.defaultNoDataColor, // default 'no data' color
            ...this.config.customCategoryColors
        }
    }

    @computed get noDataColor() {
        return this.customCategoryColors[NO_DATA_LABEL]
    }

    @computed get baseColors() {
        const {
            categoricalValues,
            colorScheme,
            bucketMaximums,
            isColorSchemeInverted
        } = this
        const numColors = bucketMaximums.length + categoricalValues.length
        const colors = colorScheme.getColors(numColors)

        if (isColorSchemeInverted) {
            reverse(colors)
        }

        return colors
    }

    @computed private get numAutoBins(): number {
        return 5
    }

    @computed get isManualBuckets(): boolean {
        return this.config.binningStrategy === ColorScaleBinningStrategy.manual
    }

    @computed get numBins(): number {
        return this.isManualBuckets
            ? this.customNumericValues.length
            : this.numAutoBins
    }

    @computed get binStepSize(): number {
        const { numAutoBins, minBinValue, valuesWithoutOutliers } = this
        if (!valuesWithoutOutliers.length) return 10

        const stepSizeInitial =
            (valuesWithoutOutliers[valuesWithoutOutliers.length - 1] -
                minBinValue) /
            numAutoBins
        return roundSigFig(stepSizeInitial, 1)
    }

    // Exclude any major outliers for legend calculation (they will be relegated to open-ended bins)
    @computed private get valuesWithoutOutliers(): number[] {
        const { sortedNumericValues } = this
        if (!sortedNumericValues.length) return []
        const sampleMean = mean(sortedNumericValues) as number
        const sampleDeviation = deviation(sortedNumericValues) as number
        return sortedNumericValues.filter(
            d => Math.abs(d - sampleMean) <= sampleDeviation * 2
        )
    }

    @computed get legendData(): ColorScaleBin[] {
        // Will eventually produce something like this:
        // [{ min: 10, max: 20, minText: "10%", maxText: "20%", color: '#faeaef' },
        //  { min: 20, max: 30, minText: "20%", maxText: "30%", color: '#fefabc' },
        //  { value: 'Foobar', text: "Foobar Boop", color: '#bbbbbb'}]
        const legendData = []
        const {
            bucketMaximums,
            baseColors,
            hasNoDataBin,
            categoricalValues,
            customCategoryColors,
            customNumericLabels,
            minBinValue,
            minPossibleValue,
            maxPossibleValue,
            customNumericColors,
            customCategoryLabels,
            customHiddenCategories,
            formatNumericValue
        } = this

        /*var unitsString = chart.model.get("units"),
            units = !isEmpty(unitsString) ? JSON.parse(unitsString) : {},
            yUnit = find(units, { property: 'y' });*/

        // Numeric 'buckets' of color
        if (minPossibleValue !== undefined && maxPossibleValue !== undefined) {
            let minValue = minBinValue
            for (let i = 0; i < bucketMaximums.length; i++) {
                const baseColor = baseColors[i]
                const color = defaultTo(
                    customNumericColors.length > i
                        ? customNumericColors[i]
                        : undefined,
                    baseColor
                )
                const maxValue = +(bucketMaximums[i] as number)
                const label = customNumericLabels[i]
                legendData.push(
                    new NumericBin({
                        isFirst: i === 0,
                        isOpenLeft: i === 0 && minValue > minPossibleValue,
                        isOpenRight:
                            i === bucketMaximums.length - 1 &&
                            maxValue < maxPossibleValue,
                        min: minValue,
                        max: maxValue,
                        color: color,
                        label: label,
                        format: formatNumericValue
                    })
                )
                minValue = maxValue
            }
        }

        let allCategoricalValues = categoricalValues

        // Inject "No data" bin
        if (hasNoDataBin && !allCategoricalValues.includes(NO_DATA_LABEL)) {
            // The color scheme colors get applied in order, starting from first, and we only use
            // as many colors as there are categorical values (excluding "No data").
            // So in order to leave it colorless, we want to append the "No data" label last.
            // -@danielgavrilov, 2020-06-02
            allCategoricalValues = [...allCategoricalValues, NO_DATA_LABEL]
        }

        // Categorical values, each assigned a color
        for (let i = 0; i < allCategoricalValues.length; i++) {
            const value = allCategoricalValues[i]
            const boundingOffset = isEmpty(bucketMaximums)
                ? 0
                : bucketMaximums.length - 1
            const baseColor = baseColors[i + boundingOffset]
            const color = customCategoryColors[value] || baseColor
            const label =
                customCategoryLabels[value] ||
                this.formatCategoricalValue(value)

            legendData.push(
                new CategoricalBin({
                    index: i,
                    value: value,
                    color: color,
                    label: label,
                    isHidden: !!customHiddenCategories[value]
                })
            )
        }

        return legendData
    }

    @bind getColor(value: number | string | undefined): string | undefined {
        if (value === undefined) return this.customCategoryColors[NO_DATA_LABEL]
        return find(this.legendData, b => b.contains(value))?.color
    }
}
