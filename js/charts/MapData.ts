import { floor, ceil, round, toArray, keys, isEmpty, reverse, includes, extend, each, find, sortedUniq, keyBy } from './Util'
import { computed, autorun, runInAction, reaction, toJS } from 'mobx'
import ChartConfig from './ChartConfig'
import { defaultTo } from './Util'
import ColorSchemes from './ColorSchemes'
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

export class NumericBin {
    index: number
    min: number
    max: number
    color: Color
    label?: string
    isHidden: boolean = false
    format: (v: number) => string

    constructor({ index, min, max, label, color, format }: { index: number, min: number, max: number, label?: string, color: Color, format: (v: number) => string }) {
        this.index = index
        this.min = min
        this.max = max
        this.color = color
        this.label = label
        this.format = format
    }

    get minText() { return this.format(this.min) }
    get maxText() { return this.format(this.max) }
    get text() { return this.label || "" }

    contains(d: MapDataValue | null): boolean {
        return !!(d && (this.index === 0 ? d.value >= this.min : d.value > this.min) && d.value <= this.max)
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
        return (d == null && this.value === 'No data') || (d != null && d.value === this.value)
    }
}

export type MapLegendBin = NumericBin | CategoricalBin

export default class MapData {
    chart: ChartConfig
    constructor(chart: ChartConfig) {
        this.chart = chart

        // Validate the map variable id selection to something on the chart
        autorun(() => {
            const hasVariable = chart.map.variableId != null && chart.vardata.variablesById[chart.map.variableId]
            if (!hasVariable && chart.data.primaryVariable) {
                const variableId = chart.data.primaryVariable.id
                runInAction(() => chart.map.props.variableId = variableId)
            }
        })

        // When automatic classification is turned off, assign defaults
        reaction(
            () => this.map.isAutoBuckets,
            () => {
                if (!this.map.isAutoBuckets) {
                    const { autoBucketMaximums } = this
                    const colorSchemeValues = toJS(this.map.props.colorSchemeValues) || []
                    for (let i = 0; i < autoBucketMaximums.length; i++) {
                        if (i >= colorSchemeValues.length)
                            colorSchemeValues.push(autoBucketMaximums[i])
                        else if (colorSchemeValues[i] === undefined)
                            colorSchemeValues[i] = autoBucketMaximums[i]
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

    @computed get knownMapEntityIds(): { [id: string]: boolean|undefined } {
        return keyBy(MapTopology.objects.world.geometries.map((g: any) => g.id))
    }

    // All available years with data for the map
    // Note that we're only interested in any data that is actually renderable
    @computed get timelineYears(): number[] {
        const {dimension} = this
        if (!dimension) return [1900, 2000]

        const {knownMapEntityIds} = this
        return sortedUniq(dimension.years.filter((_, i) => !!knownMapEntityIds[entityNameForMap(dimension.entities[i])]))
    }

    @computed get targetYear(): number {
        return defaultTo(this.map.props.targetYear, this.timelineYears[0])
    }

    @computed get legendTitle(): string {
        return defaultTo(this.map.props.legendDescription, this.dimension ? this.dimension.displayName : "")
    }

    // When automatic classification is turned on, this takes the numeric map data
    // and works out some discrete ranges to assign colors to
    @computed get autoBucketMaximums(): number[] {
        const { map, dimension } = this
        if (!dimension) return []

        const { numBuckets } = map
        const { variable } = dimension

        if (!variable.hasNumericValues || numBuckets <= 0) return []

        const rangeValue = dimension.maxValue - dimension.minValue
        const rangeMagnitude = Math.floor(Math.log(rangeValue) / Math.log(10))

        const minValue = floor(dimension.minValue, -(rangeMagnitude - 1))
        const maxValue = ceil(dimension.maxValue, -(rangeMagnitude - 1))

        const bucketMaximums = []
        for (let i = 1; i <= numBuckets; i++) {
            const value = minValue + (i / numBuckets) * (maxValue - minValue)
            bucketMaximums.push(round(value, -(rangeMagnitude - 1)))
        }

        return bucketMaximums
    }

    @computed get bucketMaximums() {
        if (this.map.isAutoBuckets) return this.autoBucketMaximums

        const { map, dimension } = this
        const { numBuckets, colorSchemeValues } = map

        if (!dimension || !dimension.variable.hasNumericValues || numBuckets <= 0)
            return []

        let values = toArray(colorSchemeValues)
        while (values.length < numBuckets)
            values.push(0)
        while (values.length > numBuckets)
            values = values.slice(0, numBuckets)
        return values
    }

    @computed get colorScheme() {
        const { baseColorScheme } = this.map
        return defaultTo(ColorSchemes[baseColorScheme], ColorSchemes[keys(ColorSchemes)[0]])
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

    @computed get legendData() {
        // Will eventually produce something like this:
        // [{ min: 10, max: 20, minText: "10%", maxText: "20%", color: '#faeaef' },
        //  { min: 20, max: 30, minText: "20%", maxText: "30%", color: '#fefabc' },
        //  { value: 'Foobar', text: "Foobar Boop", color: '#bbbbbb'}]
        const legendData = []

        const { map, dimension, bucketMaximums, baseColors, categoricalValues, customCategoryColors } = this
        const { customBucketLabels, customNumericColors, customCategoryLabels, customHiddenCategories, minBucketValue } = map

        /*var unitsString = chart.model.get("units"),
            units = !isEmpty(unitsString) ? JSON.parse(unitsString) : {},
            yUnit = find(units, { property: 'y' });*/

        // Numeric 'buckets' of color
        let minValue = minBucketValue
        for (let i = 0; i < bucketMaximums.length; i++) {
            const baseColor = baseColors[i]
            const color = defaultTo(customNumericColors[i], baseColor)
            const maxValue = +(bucketMaximums[i] as number)
            const label = customBucketLabels[i]
            legendData.push(new NumericBin({ index: i, min: minValue, max: maxValue, color: color, label: label, format: dimension ? dimension.formatValueShort : () => "" }))
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
