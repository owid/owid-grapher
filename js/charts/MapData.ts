import { round, toArray, keys, isEmpty, reverse, includes, extend, each, find, sortedUniq, keyBy } from './Util'
import { computed, autorun, runInAction, reaction, toJS } from 'mobx'
import ChartConfig from './ChartConfig'
import { defaultTo } from './Util'
import ColorSchemes, { ColorScheme } from './ColorSchemes'
import Color from './Color'
import { ChoroplethData } from './ChoroplethMap'
import { entityNameForMap } from './Util'
import DimensionWithData from './DimensionWithData'
import MapTopology from './MapTopology'

export interface MapDataValue {
    entity: string,
    value: number | string,
    year: number
}

export interface NumericBinProps {
    isFirst: boolean
    isOpenEnded: boolean
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

    @computed get min() { return this.props.min }
    @computed get max() { return this.props.max }
    @computed get color() { return this.props.color }
    @computed get minText() { return this.props.format(this.props.min) }
    @computed get maxText() {
        const str = this.props.format(this.props.max)
        if (this.props.isOpenEnded)
            return `>${str}`
        else
            return str
    }
    @computed get label() { return this.props.label }
    @computed get text() { return this.props.label || "" }
    @computed get isHidden() { return false }

    contains(d: MapDataValue | null): boolean {
        if (!d)
            return false
        else if (this.props.isOpenEnded)
            return d.value > this.min
        else if (this.props.isFirst)
            return d.value >= this.min && d.value <= this.max
        else
            return d.value > this.min && d.value <= this.max
    }
}

export class CategoricalBin {
    index: number
    value: string
    color: Color
    label: string
    isHidden: boolean

    constructor({ index, value, color, label, isHidden }: { index: number, value: string, color: Color, label: string, isHidden: boolean }) {
        this.index = index
        this.value = value
        this.color = color
        this.label = label
        this.isHidden = isHidden
    }

    get text() { return this.label || this.value }

    contains(d: MapDataValue | null): boolean {
        return (d === null && this.value === 'No data') || (d !== null && d.value === this.value)
    }
}

export type MapLegendBin = NumericBin | CategoricalBin

export default class MapData {
    chart: ChartConfig
    constructor(chart: ChartConfig) {
        this.chart = chart

        // Validate the map variable id selection to something on the chart
        autorun(() => {
            const hasVariable = chart.map.variableId && chart.vardata.variablesById[chart.map.variableId]
            if (!hasVariable && chart.data.primaryVariable) {
                const variableId = chart.data.primaryVariable.id
                runInAction(() => chart.map.props.variableId = variableId)
            }
        })

        // When automatic classification is turned off, assign defaults
        reaction(
            () => this.map.props.isManualBuckets,
            () => {
                if (this.map.props.isManualBuckets) {
                    const { autoBinMaximums } = this
                    const colorSchemeValues = toJS(this.map.props.colorSchemeValues) || []
                    for (let i = 0; i < autoBinMaximums.length; i++) {
                        if (i >= colorSchemeValues.length)
                            colorSchemeValues.push(autoBinMaximums[i])
                    }
                    this.map.props.colorSchemeValues = colorSchemeValues
                }
            }
        )
    }

    @computed get map() { return this.chart.map }
    @computed get vardata() { return this.chart.vardata }

    // Make sure map has an assigned variable and the data is ready
    @computed get isReady(): boolean {
        const { map, vardata } = this
        return map.variableId !== undefined && !!vardata.variablesById[map.variableId]
    }

    @computed get dimension(): DimensionWithData | undefined {
        return this.chart.data.filledDimensions.find(d => d.variableId === this.map.variableId)
    }

    // Figure out which entities in the variable can be shown on the map
    // (we can't render data for things that aren't countries)
    @computed get knownMapEntities(): { [entity: string]: string } {
        if (!this.dimension) return {}

        const idLookup = keyBy(MapTopology.objects.world.geometries.map((g: any) => g.id))
        const entities = this.dimension.variable.entitiesUniq.filter(e => !!idLookup[entityNameForMap(e)])
        return keyBy(entities)
    }

    // All available years with data for the map
    @computed get timelineYears(): number[] {
        const {dimension} = this
        if (!dimension) return [1900, 2000]

        return sortedUniq(dimension.years.filter((_, i) => !!this.knownMapEntities[dimension.entities[i]]))
    }

    @computed get targetYear(): number {
        return this.map.props.targetYear !== undefined ? this.map.props.targetYear : this.timelineYears[0]
    }

    @computed get legendTitle(): string {
        const {legendDescription} = this.map.props
        return legendDescription !== undefined ? legendDescription : (this.dimension ? this.dimension.displayName : "")
    }

    @computed get numAutoBins(): number {
        return 5
    }

    @computed get numBins(): number {
        return this.map.props.isManualBuckets ? this.map.props.colorSchemeValues.length : this.numAutoBins
    }

    @computed get customBucketLabels() {
        const labels = toJS(this.map.props.colorSchemeLabels) || []
        while (labels.length < this.numBins)
            labels.push(undefined)
        return labels
    }

    @computed get minBinValue(): number {
        return this.map.props.colorSchemeMinValue !== undefined ? this.map.props.colorSchemeMinValue : 0
    }

    @computed get binStepSizeDefault(): number {
        const {dimension} = this
        if (!dimension) return 10

        const {numAutoBins, minBinValue} = this

        const median95 = dimension.numericValues[Math.floor(dimension.numericValues.length*0.95)]
        const stepSizeInitial = (median95-minBinValue)/numAutoBins
        const stepMagnitude = Math.floor(Math.log(stepSizeInitial) / Math.log(10))
        const stepSize = round(stepSizeInitial, -stepMagnitude)

        return stepSize
    }

    @computed get binStepSize(): number {
        return this.map.props.binStepSize !== undefined ? this.map.props.binStepSize : this.binStepSizeDefault
    }

    @computed get manualBinMaximums(): number[] {
        if (!this.dimension || !this.dimension.hasNumericValues || this.numBins <= 0)
            return []

        const { numBins } = this
        const { colorSchemeValues } = this.map

        let values = toArray(colorSchemeValues)
        while (values.length < numBins)
            values.push(0)
        while (values.length > numBins)
            values = values.slice(0, numBins)
        return values as number[]
    }

    // When automatic classification is turned on, this takes the numeric map data
    // and works out some discrete ranges to assign colors to
    @computed get autoBinMaximums(): number[] {
        if (!this.dimension || !this.dimension.hasNumericValues || this.numBins <= 0)
            return []

        const { binStepSize, numBins, minBinValue } = this

        const bucketMaximums = []
        let nextMaximum = minBinValue+binStepSize
        for (let i = 0; i < numBins; i++) {
            bucketMaximums.push(nextMaximum)
            nextMaximum += binStepSize
        }

        return bucketMaximums
    }

    @computed get bucketMaximums(): number[] {
        if (this.map.props.isManualBuckets)
            return this.manualBinMaximums
        else
            return this.autoBinMaximums
    }

    @computed get defaultColorScheme(): ColorScheme {
        return ColorSchemes[keys(ColorSchemes)[0]] as ColorScheme
    }

    @computed get colorScheme(): ColorScheme {
        const colorScheme = ColorSchemes[this.map.baseColorScheme]
        return colorScheme !== undefined ? colorScheme : this.defaultColorScheme
    }

    @computed get baseColors() {
        const { dimension, colorScheme, bucketMaximums } = this
        const { isColorSchemeInverted } = this.map
        const numColors = bucketMaximums.length + (dimension ? dimension.variable.categoricalValues.length : 0)
        const colors = colorScheme.getColors(numColors)

        if (isColorSchemeInverted) {
            reverse(colors)
        }

        return colors
    }

    // Add default 'No data' category
    @computed get categoricalValues() {
        const { dimension } = this
        const categoricalValues = dimension ? dimension.variable.categoricalValues : []
        if (!includes(categoricalValues, "No data"))
            return ["No data"].concat(categoricalValues)
        else
            return categoricalValues
    }

    // Ensure there's always a custom color for "No data"
    @computed get customCategoryColors(): { [key: string]: Color } {
        return extend({}, this.map.customCategoryColors, { 'No data': this.map.noDataColor })
    }

    @computed get legendData(): (NumericBin|CategoricalBin)[] {
        // Will eventually produce something like this:
        // [{ min: 10, max: 20, minText: "10%", maxText: "20%", color: '#faeaef' },
        //  { min: 20, max: 30, minText: "20%", maxText: "30%", color: '#fefabc' },
        //  { value: 'Foobar', text: "Foobar Boop", color: '#bbbbbb'}]
        const { dimension } = this
        if (!dimension) return []

        const legendData = []
        const { map, bucketMaximums, baseColors, categoricalValues, customCategoryColors, customBucketLabels, minBinValue } = this
        const { customNumericColors, customCategoryLabels, customHiddenCategories } = map

        /*var unitsString = chart.model.get("units"),
            units = !isEmpty(unitsString) ? JSON.parse(unitsString) : {},
            yUnit = find(units, { property: 'y' });*/

        // Numeric 'buckets' of color
        let minValue = minBinValue
        for (let i = 0; i < bucketMaximums.length; i++) {
            const baseColor = baseColors[i]
            const color = defaultTo(customNumericColors.length > i ? customNumericColors[i] : undefined, baseColor)
            const maxValue = +(bucketMaximums[i] as number)
            const label = customBucketLabels[i]
            legendData.push(new NumericBin({ isFirst: i === 0, isOpenEnded: i === bucketMaximums.length-1 && maxValue < dimension.maxValue, min: minValue, max: maxValue, color: color, label: label, format: dimension ? dimension.formatValueShort : () => "" }))
            minValue = maxValue
        }

        // Categorical values, each assigned a color
        for (let i = 0; i < categoricalValues.length; i++) {
            const value = categoricalValues[i]
            const boundingOffset = isEmpty(bucketMaximums) ? 0 : bucketMaximums.length - 1
            const baseColor = baseColors[i + boundingOffset]
            const color = customCategoryColors[value] || baseColor
            const label = customCategoryLabels[value] || ""

            legendData.push(new CategoricalBin({ index: i, value: value, color: color, label: label, isHidden: customHiddenCategories[value] }))
        }

        return legendData
    }

    // Get values for the current year, without any color info yet
    @computed get valuesByEntity(): { [key: string]: MapDataValue } {
        const { map, dimension, targetYear } = this
        if (!dimension) return {}

        const { tolerance } = map
        const { years, values, entities } = dimension
        const currentValues: { [key: string]: MapDataValue } = {}

        for (let i = 0; i < values.length; i++) {
            const year = years[i]
            if (year < targetYear - tolerance || year > targetYear + tolerance)
                continue

            // Make sure we use the closest year within tolerance (favoring later years)
            const entityName = entityNameForMap(entities[i])
            const existing = currentValues[entityName]
            if (existing && Math.abs(existing.year - targetYear) < Math.abs(year - targetYear))
                continue

            currentValues[entityName] = {
                entity: entities[i],
                year: years[i],
                value: values[i],
            }
        }

        return currentValues
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
        return this.dimension ? this.dimension.formatValueLong : () => ""
    }
}
