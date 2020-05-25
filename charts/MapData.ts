import { computed, autorun, runInAction, reaction, toJS } from "mobx"
import { mean, deviation } from "d3-array"

import { ChartConfig } from "./ChartConfig"
import { ColorSchemes, ColorScheme } from "./ColorSchemes"
import { Color } from "./Color"
import { ChoroplethData } from "./ChoroplethMap"
import { ChartDimensionWithOwidVariable } from "./ChartDimensionWithOwidVariable"
import { MapTopology } from "./MapTopology"

import {
    defaultTo,
    isString,
    findClosestYear,
    round,
    toArray,
    keys,
    isEmpty,
    reverse,
    extend,
    each,
    find,
    keyBy,
    isNumber,
    sortBy,
    entityNameForMap,
    formatYear
} from "./Util"
import { Time, getClosestTime } from "./TimeBounds"
import { ChartTransform } from "./ChartTransform"

export interface MapDataValue {
    entity: string
    value: number | string
    year: number
}

export interface NumericBinProps {
    isFirst: boolean
    isOpenLeft: boolean
    isOpenRight: boolean
    min: number
    max: number
    label?: string
    color: string
    format: (v: number) => string
}

export class NumericBin {
    props: NumericBinProps
    constructor(props: NumericBinProps) {
        this.props = props
    }

    @computed get min() {
        return this.props.min
    }
    @computed get max() {
        return this.props.max
    }
    @computed get color() {
        return this.props.color
    }
    @computed get minText() {
        const str = this.props.format(this.props.min)
        if (this.props.isOpenLeft) return `<${str}`
        else return str
    }
    @computed get maxText() {
        const str = this.props.format(this.props.max)
        if (this.props.isOpenRight) return `>${str}`
        else return str
    }
    @computed get label() {
        return this.props.label
    }
    @computed get text() {
        return this.props.label || ""
    }
    @computed get isHidden() {
        return false
    }

    contains(d: MapDataValue | null): boolean {
        if (!d) return false
        else if (this.props.isOpenLeft) return d.value <= this.max
        else if (this.props.isOpenRight) return d.value > this.min
        else if (this.props.isFirst)
            return d.value >= this.min && d.value <= this.max
        else return d.value > this.min && d.value <= this.max
    }

    equals(other: ColorLegendBin): boolean {
        return (
            other instanceof NumericBin &&
            this.min === other.min &&
            this.max === other.max
        )
    }
}

export class CategoricalBin {
    index: number
    value: string
    color: Color
    label: string
    isHidden: boolean

    constructor({
        index,
        value,
        color,
        label,
        isHidden
    }: {
        index: number
        value: string
        color: Color
        label: string
        isHidden: boolean
    }) {
        this.index = index
        this.value = value
        this.color = color
        this.label = label
        this.isHidden = isHidden
    }

    get text() {
        return this.label || this.value
    }

    contains(d: MapDataValue | null): boolean {
        return (
            (d === null && this.value === "No data") ||
            (d !== null && d.value === this.value)
        )
    }

    equals(other: ColorLegendBin): boolean {
        return other instanceof CategoricalBin && this.index === other.index
    }
}

export type ColorLegendBin = NumericBin | CategoricalBin

export class MapData extends ChartTransform {
    constructor(chart: ChartConfig) {
        super(chart)

        if (!chart.isNode) this.ensureValidConfig()
    }

    @computed get isValidConfig() {
        return !!this.chart.data.primaryVariable
    }

    ensureValidConfig() {
        const { chart } = this

        // Validate the map variable id selection to something on the chart
        autorun(() => {
            const hasVariable =
                chart.map.variableId &&
                chart.variablesById[chart.map.variableId]
            if (!hasVariable && chart.data.primaryVariable) {
                const variableId = chart.data.primaryVariable.id
                runInAction(() => (chart.map.props.variableId = variableId))
            }
        })

        // When automatic classification is turned off, assign defaults
        reaction(
            () => this.map.props.isManualBuckets,
            () => {
                if (this.map.props.isManualBuckets) {
                    const { autoBinMaximums } = this
                    const colorSchemeValues =
                        toJS(this.map.props.colorSchemeValues) || []
                    for (let i = 0; i < autoBinMaximums.length; i++) {
                        if (i >= colorSchemeValues.length)
                            colorSchemeValues.push(autoBinMaximums[i])
                    }
                    this.map.props.colorSchemeValues = colorSchemeValues
                }
            }
        )
    }

    @computed get hasTimeline(): boolean {
        // Maps have historically had an independent property to hide the timeline.
        // The config objects in the database still have this property, though we have not yet run
        // into a case where the timeline needs to be shown
        return (
            this.timelineYears.length > 1 &&
            !this.chart.props.hideTimeline &&
            !this.map.props.hideTimeline
        )
    }

    @computed get map() {
        return this.chart.map
    }

    // Make sure map has an assigned variable and the data is ready
    @computed get isReady(): boolean {
        const { map } = this
        return (
            map.variableId !== undefined &&
            !!this.chart.variablesById[map.variableId]
        )
    }

    @computed get dimension(): ChartDimensionWithOwidVariable | undefined {
        return this.chart.data.filledDimensions.find(
            d => d.variableId === this.map.variableId
        )
    }

    // Figure out which entities in the variable can be shown on the map
    // (we can't render data for things that aren't countries)
    @computed get knownMapEntities(): { [entity: string]: string } {
        if (!this.dimension) return {}

        const idLookup = keyBy(
            MapTopology.objects.world.geometries.map((g: any) => g.id)
        )
        const entities = this.dimension.variable.entitiesUniq.filter(
            e => !!idLookup[entityNameForMap(e)]
        )
        return keyBy(entities)
    }

    // Reverse lookup of map ids => data entities
    @computed get mapToDataEntities(): { [id: string]: string } {
        if (!this.dimension) return {}

        const entities: { [id: string]: string } = {}
        for (const entity of this.dimension.variable.entitiesUniq) {
            entities[entityNameForMap(entity)] = entity
        }
        return entities
    }

    // Filter data to what can be display on the map (across all years)
    @computed get mappableData() {
        const { dimension } = this

        const mappableData: {
            years: number[]
            entities: string[]
            values: (number | string)[]
        } = {
            years: [],
            entities: [],
            values: []
        }

        if (dimension) {
            const { knownMapEntities } = this
            for (let i = 0; i < dimension.years.length; i++) {
                const year = dimension.years[i]
                const entity = dimension.entityNames[i]
                const value = dimension.values[i]

                if (knownMapEntities[entity]) {
                    mappableData.years.push(year)
                    mappableData.entities.push(entity)
                    mappableData.values.push(value)
                }
            }
        }

        return mappableData
    }

    @computed get sortedNumericValues(): number[] {
        return sortBy(
            this.mappableData.values.filter(v => isNumber(v))
        ) as number[]
    }

    @computed get minPossibleValue(): number {
        return this.sortedNumericValues[0]
    }

    @computed get maxPossibleValue(): number {
        return this.sortedNumericValues[this.sortedNumericValues.length - 1]
    }

    @computed get formatValueShort() {
        return this.dimension ? this.dimension.formatValueShort : () => ""
    }

    @computed get categoricalValues(): string[] {
        // Ensure presence of 'No data' category
        const valuesMap = new Map<string, boolean>()
        valuesMap.set("No data", true)

        for (const value of this.mappableData.values) {
            if (isString(value)) {
                valuesMap.set(value, true)
            }
        }

        return Array.from(valuesMap.keys())
    }

    // All available years with data for the map
    @computed get availableYears(): Time[] {
        const { mappableData } = this
        return mappableData.years.filter(
            (_, i) => !!this.knownMapEntities[mappableData.entities[i]]
        )
    }

    // Overrides the default ChartTransform#targetYear method because the map stores the target year
    // separately in the config.
    @computed get targetYear(): Time {
        return getClosestTime(this.timelineYears, this.map.targetYear, 2000)
    }

    @computed get legendTitle(): string {
        return "" // Disabled for now; redundant with chart title
        //const {legendDescription} = this.map.props
        //return legendDescription !== undefined ? legendDescription : (this.dimension ? this.dimension.displayName : "")
    }

    @computed get numAutoBins(): number {
        return 5
    }

    @computed get numBins(): number {
        return this.map.props.isManualBuckets
            ? this.map.props.colorSchemeValues.length
            : this.numAutoBins
    }

    @computed get customBucketLabels() {
        const labels = toJS(this.map.props.colorSchemeLabels) || []
        while (labels.length < this.numBins) labels.push(undefined)
        return labels
    }

    // Exclude any major outliers for legend calculation (they will be relegated to open-ended bins)
    @computed get commonValues(): number[] {
        const { sortedNumericValues } = this
        if (!sortedNumericValues.length) return []
        const sampleMean = mean(sortedNumericValues) as number
        const sampleDeviation = deviation(sortedNumericValues) as number
        return sortedNumericValues.filter(
            d => Math.abs(d - sampleMean) <= sampleDeviation * 2
        )
    }

    @computed get autoMinBinValue(): number {
        const minValue = Math.min(0, this.commonValues[0])
        const magnitude = Math.floor(Math.log(minValue) / Math.log(10))
        return Math.min(0, round(minValue, -magnitude))
    }

    @computed get minBinValue(): number {
        return this.map.props.colorSchemeMinValue !== undefined
            ? this.map.props.colorSchemeMinValue
            : this.autoMinBinValue
    }

    @computed get binStepSizeDefault(): number {
        const { numAutoBins, minBinValue, commonValues } = this
        if (!commonValues.length) return 10

        const stepSizeInitial =
            (commonValues[commonValues.length - 1] - minBinValue) / numAutoBins
        const stepMagnitude = Math.floor(
            Math.log(stepSizeInitial) / Math.log(10)
        )
        return round(stepSizeInitial, -stepMagnitude)
    }

    @computed get binStepSize(): number {
        return this.map.props.binStepSize !== undefined
            ? this.map.props.binStepSize
            : this.binStepSizeDefault
    }

    @computed get manualBinMaximums(): number[] {
        if (!this.sortedNumericValues.length || this.numBins <= 0) return []

        const { numBins } = this
        const { colorSchemeValues } = this.map

        let values = toArray(colorSchemeValues)
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
        if (this.map.props.isManualBuckets) return this.manualBinMaximums
        else return this.autoBinMaximums
    }

    @computed get defaultColorScheme(): ColorScheme {
        return ColorSchemes[keys(ColorSchemes)[0]] as ColorScheme
    }

    @computed get colorScheme(): ColorScheme {
        const colorScheme = ColorSchemes[this.map.baseColorScheme]
        return colorScheme !== undefined ? colorScheme : this.defaultColorScheme
    }

    @computed get singleColorScale(): boolean {
        return this.colorScheme.singleColorScale
    }

    @computed get baseColors() {
        const { categoricalValues, colorScheme, bucketMaximums } = this
        const { isColorSchemeInverted } = this.map
        const numColors = bucketMaximums.length + categoricalValues.length - 1
        const colors = colorScheme.getColors(numColors)

        if (isColorSchemeInverted) {
            reverse(colors)
        }

        return colors
    }

    // Ensure there's always a custom color for "No data"
    @computed get customCategoryColors(): { [key: string]: Color } {
        return extend({}, this.map.customCategoryColors, {
            "No data": this.map.noDataColor
        })
    }

    @computed get legendData(): (NumericBin | CategoricalBin)[] {
        // Will eventually produce something like this:
        // [{ min: 10, max: 20, minText: "10%", maxText: "20%", color: '#faeaef' },
        //  { min: 20, max: 30, minText: "20%", maxText: "30%", color: '#fefabc' },
        //  { value: 'Foobar', text: "Foobar Boop", color: '#bbbbbb'}]
        const { minPossibleValue, maxPossibleValue, formatValueShort } = this

        const legendData = []
        const {
            map,
            bucketMaximums,
            baseColors,
            categoricalValues,
            customCategoryColors,
            customBucketLabels,
            minBinValue
        } = this
        const {
            customNumericColors,
            customCategoryLabels,
            customHiddenCategories
        } = map

        /*var unitsString = chart.model.get("units"),
            units = !isEmpty(unitsString) ? JSON.parse(unitsString) : {},
            yUnit = find(units, { property: 'y' });*/

        // Numeric 'buckets' of color
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
            const label = customBucketLabels[i]
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
                    format: formatValueShort
                })
            )
            minValue = maxValue
        }

        // Categorical values, each assigned a color
        for (let i = 0; i < categoricalValues.length; i++) {
            const value = categoricalValues[i]
            const boundingOffset = isEmpty(bucketMaximums)
                ? 0
                : bucketMaximums.length - 1
            const baseColor = baseColors[i + boundingOffset]
            const color = customCategoryColors[value] || baseColor
            const label = customCategoryLabels[value] || ""

            legendData.push(
                new CategoricalBin({
                    index: i,
                    value: value,
                    color: color,
                    label: label,
                    isHidden: customHiddenCategories[value]
                })
            )
        }

        return legendData
    }

    // Get values for the current year, without any color info yet
    @computed get valuesByEntity(): { [key: string]: MapDataValue } {
        const { map, targetYear } = this
        const valueByEntityAndYear = this.dimension?.valueByEntityAndYear

        if (targetYear === undefined || !valueByEntityAndYear) return {}

        const { tolerance } = map
        const entities = Object.keys(this.knownMapEntities)

        const result: { [key: string]: MapDataValue } = {}

        entities.forEach(entity => {
            const valueByYear = valueByEntityAndYear.get(entity)
            if (!valueByYear) return
            const years = Array.from(valueByYear.keys())
            const year = findClosestYear(years, targetYear, tolerance)
            if (year === undefined) return
            const value = valueByYear.get(year)
            if (value === undefined) return
            result[entity] = { entity, year, value }
        })

        return result
    }

    // Get the final data incorporating the binning colors
    @computed get choroplethData(): ChoroplethData {
        const { valuesByEntity, legendData } = this
        const choroplethData: ChoroplethData = {}

        each(valuesByEntity, (datum, entity) => {
            const bin = find(legendData, b => b.contains(datum))
            if (!bin) return
            choroplethData[entity] = extend({}, datum, {
                color: bin.color,
                highlightFillColor: bin.color
            })
        })

        return choroplethData
    }

    @computed get formatTooltipValue(): (d: number | string) => string {
        const formatValueLong = this.dimension && this.dimension.formatValueLong
        const customLabels = this.map.tooltipUseCustomLabels
            ? this.customBucketLabels
            : []
        return formatValueLong
            ? (d: number | string) => {
                  if (isString(d)) return d
                  else return customLabels[d] ?? formatValueLong(d)
              }
            : () => ""
    }

    @computed get formatYear(): (year: number) => string {
        return this.dimension ? this.dimension.formatYear : formatYear
    }
}
