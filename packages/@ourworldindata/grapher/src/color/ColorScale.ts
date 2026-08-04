import * as _ from "lodash-es"
import { computed, toJS, makeObservable } from "mobx"
import { ColorScaleConfig } from "./ColorScaleConfig"
import { mapNullToUndefined, sortNumeric } from "@ourworldindata/utils"
import { pairs } from "d3-array"
import { ColorSchemes } from "../color/ColorSchemes"
import { ColorScheme } from "../color/ColorScheme"
import { ColorScaleBin, NumericBin, CategoricalBin } from "./ColorScaleBin"
import { GRAY_90, OWID_NO_DATA_GRAY } from "./ColorConstants"
import {
    ColorScaleConfigInterface,
    ColorSchemeName,
    Color,
    CoreValueType,
    OwidVariableRoundingMode,
} from "@ourworldindata/types"
import { CoreColumn } from "@ourworldindata/core-table"
import * as R from "remeda"
import { runBinningStrategy } from "./BinningStrategies.js"

export const NO_DATA_LABEL = "No data"
export const PROJECTED_DATA_LABEL = "Projected data"
export const NOT_APPLICABLE_LABEL = "Not applicable"

export const NOT_APPLICABLE_COLOR = GRAY_90

export interface ColorScaleManager {
    colorScaleConfig?: ColorScaleConfigInterface
    hasNoDataBin?: boolean
    hasProjectedDataBin?: boolean
    hasNotApplicableBin?: boolean
    defaultNoDataColor?: string
    defaultBaseColorScheme?: ColorSchemeName
    colorScaleColumn?: CoreColumn
}

export class ColorScale {
    private readonly manager: Readonly<ColorScaleManager>
    constructor(manager: ColorScaleManager = {}) {
        makeObservable(this)
        this.manager = manager
    }

    // Config accessors

    @computed get config(): ColorScaleConfigInterface {
        return this.manager.colorScaleConfig ?? new ColorScaleConfig()
    }

    @computed get customNumericValues(): number[] {
        return this.config.customNumericValues ?? []
    }

    @computed get customNumericColorsActive(): boolean {
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

    @computed private get hasNotApplicableBin(): boolean {
        return this.manager.hasNotApplicableBin || false
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

    @computed private get manualBinThresholds(): number[] {
        if (!this.sortedNumericValues.length || this.numNumericBins <= 0)
            return []

        return this.customNumericValues
    }

    // When automatic classification is turned on, this takes the numeric map data
    // and works out some discrete ranges to assign colors to
    @computed get autoBinThresholds(): number[] {
        if (this.config.binningStrategy === "manual") {
            throw new Error(
                "Cannot compute automatic bin thresholds when binning is set to manual"
            )
        }
        return runBinningStrategy({
            sortedValues: this.sortedNumericValues,
            isPercent: this.colorScaleColumn?.shortUnit === "%",
            numDecimalPlaces: this.colorScaleColumn?.numDecimalPlaces,

            strategy: this.config.binningStrategy,
            createBinForMidpoint: this.config.createBinForMidpoint,
            minValue: this.config.minValue,
            maxValue: this.config.maxValue,
            midpoint: this.config.midpoint,
            midpointMode: this.config.midpointMode,
        }).bins
    }

    @computed private get bucketThresholds(): number[] {
        return this.isManualBuckets
            ? this.manualBinThresholds
            : this.autoBinThresholds
    }

    @computed private get customCategoryColors(): { [key: string]: Color } {
        // Provide default colors for the injected "No data" and "Not applicable"
        // bins. They're added conditionally so that a data category that happens
        // to share their name isn't hijacked away from its color scheme color.
        // Note that on maps, both bins are rendered as patterns with fixed
        // colors, so their bin color is only used in a few places, e.g. for
        // entities that don't belong in any color group on scatters/marimekkos
        // or for the the admin's color scale editor
        return {
            ...(this.hasNoDataBin
                ? { [NO_DATA_LABEL]: this.defaultNoDataColor }
                : undefined),
            ...(this.hasNotApplicableBin
                ? { [NOT_APPLICABLE_LABEL]: NOT_APPLICABLE_COLOR }
                : undefined),
            ...this.config.customCategoryColors,
        }
    }

    @computed get noDataColor(): Color {
        return (
            this.customCategoryColors[NO_DATA_LABEL] ?? this.defaultNoDataColor
        )
    }

    @computed get noDataLabel(): string {
        return this.customCategoryLabels[NO_DATA_LABEL] ?? NO_DATA_LABEL
    }

    @computed get notApplicableLabel(): string {
        return (
            this.customCategoryLabels[NOT_APPLICABLE_LABEL] ??
            NOT_APPLICABLE_LABEL
        )
    }

    @computed get baseColors(): Color[] {
        const { categoricalValues, colorScheme, isColorSchemeInverted } = this
        const numColors = this.numNumericBins + categoricalValues.length
        const colors = colorScheme.getColors(numColors)

        if (isColorSchemeInverted) return colors.toReversed()
        else return colors
    }

    @computed get isManualBuckets(): boolean {
        return this.config.binningStrategy === "manual"
    }

    @computed get numNumericBins(): number {
        if (!this.sortedNumericValues.length) return 0

        return this.isManualBuckets
            ? Math.max(this.customNumericValues.length - 1, 0)
            : this.autoBinThresholds.length - 1
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
            hasNotApplicableBin,
            categoricalValues,
            customCategoryColors,
            customCategoryLabels,
            customHiddenCategories,
            colorScheme,
        } = this

        let allCategoricalValues = categoricalValues

        // The injected bins below must be appended _after_ the data-driven
        // values: the color scheme allocates colors for the data values only
        // (see baseColors), so injecting a bin earlier would shift every
        // subsequent data value onto its neighbour's color. The injected bins
        // don't take part in the scheme; their colors come from the
        // customCategoryColors defaults ("Not applicable", "No data") or from
        // a pattern with a fixed color ("Projected data")

        // Inject "Not applicable" bin for the indicator's reference entity
        if (
            hasNotApplicableBin &&
            !allCategoricalValues.includes(NOT_APPLICABLE_LABEL)
        ) {
            allCategoricalValues = [
                ...allCategoricalValues,
                NOT_APPLICABLE_LABEL,
            ]
        }

        // Inject "No data" bin
        if (hasNoDataBin && !allCategoricalValues.includes(NO_DATA_LABEL)) {
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

            // Use colorMap if available and the value exists in it
            let baseColor: Color | undefined
            if (colorScheme.colorMap && value in colorScheme.colorMap) {
                baseColor = colorScheme.colorMap[value]
            } else {
                baseColor = baseColors[index + boundingOffset]
            }

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
