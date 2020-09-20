import { computed, toJS } from "mobx"
import { mean, deviation } from "d3-array"
import { bind } from "decko"

import { ColorScaleConfigInterface } from "./ColorScaleConfig"
import {
    isEmpty,
    reverse,
    toArray,
    first,
    last,
    identity,
    roundSigFig,
    mapNullToUndefined,
} from "grapher/utils/Util"
import { Color } from "grapher/core/GrapherConstants"
import { ColorSchemes } from "grapher/color/ColorSchemes"
import { ColorScaleBin, NumericBin, CategoricalBin } from "./ColorScaleBin"
import { BinningStrategy, getBinMaximums } from "./BinningStrategies"
import { AbstractColumn } from "owidTable/OwidTable"

const NO_DATA_LABEL = "No data"

interface ColorScaleOptionsProvider {
    config: ColorScaleConfigInterface
    categoricalValues: string[]
    hasNoDataBin: boolean
    defaultNoDataColor?: string
    defaultBaseColorScheme?: string
    column?: AbstractColumn
}

export class ColorScale {
    private options: Readonly<ColorScaleOptionsProvider>
    constructor(options: ColorScaleOptionsProvider) {
        this.options = options
    }

    // Config accessors

    @computed get config() {
        return this.options.config
    }

    @computed get customNumericValues() {
        return this.config.customNumericValues ?? []
    }

    @computed get customNumericColorsActive() {
        return this.config.customNumericColorsActive ?? false
    }

    @computed get customNumericColors(): (Color | undefined)[] {
        return this.customNumericColorsActive
            ? mapNullToUndefined(this.config.customNumericColors)
            : []
    }

    @computed get customHiddenCategories(): {
        [key: string]: true | undefined
    } {
        return this.config.customHiddenCategories ?? {}
    }

    @computed get customNumericLabels() {
        if (!this.isManualBuckets) return []

        const labels =
            mapNullToUndefined(toJS(this.config.customNumericLabels)) || []
        while (labels.length < this.numBins) labels.push(undefined)
        return labels
    }

    @computed get isColorSchemeInverted() {
        return this.config.colorSchemeInvert ?? false
    }

    @computed private get customCategoryLabels(): {
        [key: string]: string | undefined
    } {
        return this.config.customCategoryLabels ?? {}
    }

    @computed get baseColorScheme() {
        return (
            this.config.baseColorScheme ??
            this.options.defaultBaseColorScheme ??
            "BuGn"
        )
    }

    @computed private get defaultColorScheme() {
        return ColorSchemes["BuGn"]!
    }

    @computed private get defaultNoDataColor() {
        return this.options.defaultNoDataColor ?? "#eee"
    }

    @computed get formatCategoricalValue(): (v: string) => string {
        return this.options.column?.table.getLabelForEntityName ?? identity
    }

    @computed get legendDescription() {
        return this.config.legendDescription
    }

    // Transforms

    @computed private get hasNoDataBin() {
        return this.options.hasNoDataBin
    }

    @computed get sortedNumericValues() {
        return this.options.column?.sortedValues ?? []
    }

    @computed private get minPossibleValue() {
        return first(this.sortedNumericValues)
    }

    @computed private get maxPossibleValue() {
        return last(this.sortedNumericValues)
    }

    @computed private get categoricalValues() {
        return this.options.categoricalValues
    }

    @computed private get colorScheme() {
        return ColorSchemes[this.baseColorScheme] ?? this.defaultColorScheme
    }

    @computed get singleColorScale() {
        return this.colorScheme.singleColorScale
    }

    @computed get autoMinBinValue() {
        const minValue = Math.min(0, this.sortedNumericValuesWithoutOutliers[0])
        return isNaN(minValue) ? 0 : roundSigFig(minValue, 1)
    }

    @computed private get minBinValue() {
        return this.config.customNumericMinValue ?? this.autoMinBinValue
    }

    @computed private get manualBinMaximums() {
        if (!this.sortedNumericValues.length || this.numBins <= 0) return []

        const { numBins, customNumericValues } = this

        let values = toArray(customNumericValues)
        while (values.length < numBins) values.push(0)
        while (values.length > numBins) values = values.slice(0, numBins)
        return values
    }

    // When automatic classification is turned on, this takes the numeric map data
    // and works out some discrete ranges to assign colors to
    @computed get autoBinMaximums() {
        return getBinMaximums({
            binningStrategy: this.config.binningStrategy,
            sortedValues: this.sortedNumericBinningValues,
            binCount: this.numAutoBins,
            minBinValue: this.minBinValue,
        })
    }

    @computed private get bucketMaximums() {
        return this.isManualBuckets
            ? this.manualBinMaximums
            : this.autoBinMaximums
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
        const {
            categoricalValues,
            colorScheme,
            bucketMaximums,
            isColorSchemeInverted,
        } = this
        const numColors = bucketMaximums.length + categoricalValues.length
        const colors = colorScheme.getColors(numColors)

        if (isColorSchemeInverted) reverse(colors)

        return colors
    }

    @computed get numAutoBins() {
        return this.config.binningStrategyBinCount ?? 5
    }

    @computed get isManualBuckets() {
        return this.config.binningStrategy === BinningStrategy.manual
    }

    @computed get numBins() {
        return this.isManualBuckets
            ? this.customNumericValues.length
            : this.numAutoBins
    }

    // Exclude any major outliers for legend calculation (they will be relegated to open-ended bins)
    @computed private get sortedNumericValuesWithoutOutliers() {
        const { sortedNumericValues } = this
        if (!sortedNumericValues.length) return []
        const sampleMean = mean(sortedNumericValues) as number
        const sampleDeviation = deviation(sortedNumericValues) as number
        return sortedNumericValues.filter(
            (d) => Math.abs(d - sampleMean) <= sampleDeviation * 2
        )
    }

    /** Sorted numeric values passed onto the binning algorithms */
    @computed private get sortedNumericBinningValues() {
        return this.sortedNumericValuesWithoutOutliers.filter(
            (v) => v > this.minBinValue
        )
    }

    @computed get legendData() {
        // todo: turn comment into unit test
        // Will eventually produce something like this:
        // [{ min: 10, max: 20, minText: "10%", maxText: "20%", color: '#faeaef' },
        //  { min: 20, max: 30, minText: "20%", maxText: "30%", color: '#fefabc' },
        //  { value: 'Foobar', text: "Foobar Boop", color: '#bbbbbb'}]
        const legendData: ColorScaleBin[] = []
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
            options,
        } = this

        // Numeric 'buckets' of color
        if (minPossibleValue !== undefined && maxPossibleValue !== undefined) {
            let min = minBinValue
            for (let i = 0; i < bucketMaximums.length; i++) {
                const baseColor = baseColors[i]
                const color = customNumericColors[i] ?? baseColor
                const max = +(bucketMaximums[i] as number)
                const label = customNumericLabels[i]

                const displayMin =
                    options.column?.formatValueShort(min) ?? min.toString()
                const displayMax =
                    options.column?.formatValueShort(max) ?? max.toString()

                legendData.push(
                    new NumericBin({
                        isFirst: i === 0,
                        isOpenLeft: i === 0 && min > minPossibleValue,
                        isOpenRight:
                            i === bucketMaximums.length - 1 &&
                            max < maxPossibleValue,
                        min,
                        max,
                        color,
                        label,
                        displayMin,
                        displayMax,
                    })
                )
                min = max
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
        for (let index = 0; index < allCategoricalValues.length; index++) {
            const value = allCategoricalValues[index]
            const boundingOffset = isEmpty(bucketMaximums)
                ? 0
                : bucketMaximums.length - 1
            const baseColor = baseColors[index + boundingOffset]
            const color = customCategoryColors[value] || baseColor
            const label =
                customCategoryLabels[value] ||
                this.formatCategoricalValue(value)

            legendData.push(
                new CategoricalBin({
                    index,
                    value,
                    color,
                    label,
                    isHidden: !!customHiddenCategories[value],
                })
            )
        }

        return legendData
    }

    @bind getColor(value: number | string | undefined) {
        return value === undefined
            ? this.customCategoryColors[NO_DATA_LABEL]
            : this.legendData.find((b) => b.contains(value))?.color
    }
}
