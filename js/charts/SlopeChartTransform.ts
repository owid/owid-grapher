import { scaleOrdinal } from 'd3-scale'
import { some, union, min, max, find, isEmpty } from './Util'
import { computed } from 'mobx'
import ChartConfig from './ChartConfig'
import { defaultTo, defaultWith, findClosest } from './Util'
import DimensionWithData from './DimensionWithData'
import Observations from './Observations'
import { SlopeChartSeries, SlopeChartValue } from './LabelledSlopes'
import { first, last, makeSafeForCSS } from './Util'
import IChartTransform from './IChartTransform'
import ColorSchemes from './ColorSchemes'

// Responsible for translating chart configuration into the form
// of a line chart
export default class SlopeChartTransform implements IChartTransform {
    chart: ChartConfig

    constructor(chart: ChartConfig) {
        this.chart = chart
    }

    @computed get isValidConfig(): boolean {
        return some(this.chart.dimensions, d => d.property === 'y')
    }

    @computed get failMessage(): string | undefined {
        const { filledDimensions } = this.chart.data
        if (!some(filledDimensions, d => d.property === 'y'))
            return "Missing Y axis variable"
        else if (isEmpty(this.data))
            return "No matching data"
        else
            return undefined
    }

    @computed get timelineYears(): number[] {
        return union(...this.chart.data.axisDimensions.map(d => d.variable.yearsUniq))
    }

    @computed get minTimelineYear(): number {
        return defaultTo(min(this.timelineYears), 1900)
    }

    @computed get maxTimelineYear(): number {
        return defaultTo(max(this.timelineYears), 2000)
    }

    @computed get startYear(): number {
        const minYear = defaultWith(this.chart.timeDomain[0], () => this.minTimelineYear)
        return defaultWith(findClosest(this.timelineYears, minYear), () => this.minTimelineYear)
    }

    @computed get endYear(): number {
        const maxYear = defaultWith(this.chart.timeDomain[1], () => this.maxTimelineYear)
        return defaultWith(findClosest(this.timelineYears, maxYear), () => this.maxTimelineYear)
    }

    @computed.struct get xDomain(): [number, number] {
        return [this.startYear, this.endYear]
    }

    @computed.struct get sizeDim(): DimensionWithData|undefined {
        return find(this.chart.data.filledDimensions, d => d.property === 'size')
    }

    @computed.struct get colorDim(): DimensionWithData|undefined {
        return find(this.chart.data.filledDimensions, d => d.property === 'color')
    }

    @computed.struct get yDimension(): DimensionWithData | undefined {
        return find(this.chart.data.filledDimensions, d => d.property === 'y')
    }

    // helper method to directly get the associated color value given an Entity
    // dimension data saves color a level deeper. eg: { Afghanistan => { 2015: Asia|Color }}
    // this returns that data in the form { Afghanistan => Asia }
    @computed get colorByEntity(): Map<string, any> {
        const { colorDim, colorScale }= this
        const colorByEntity = new Map<string, any>()

        if (colorDim !== undefined) {
            colorDim.valueByEntityAndYear.forEach((yearToColorMap, entity) => {
                const values = Array.from(yearToColorMap.values())
                colorByEntity.set(entity, colorScale(values[0].toString()))
            })
        }
        return colorByEntity
    }

    // helper method to directly get the associated size value given an Entity
    // dimension data saves size a level deeper. eg: { Afghanistan => { 1990: 1, 2015: 10 }}
    // this returns that data in the form { Afghanistan => 1 }
    @computed get sizeByEntity(): Map<string, any> {
        const { sizeDim } = this
        const sizeByEntity = new Map<string, any>()

        if (sizeDim !== undefined) {
            sizeDim.valueByEntityAndYear.forEach((yearToSizeMap, entity) => {
                const values = Array.from(yearToSizeMap.values())
                sizeByEntity.set(entity, values[0]) // hack: default to the value associated with the first year
            })
        }
        return sizeByEntity
    }

    @computed get defaultColors(): string[] {
        return [ // default color scheme for continents
            "#5675c1", // Africa
            "#aec7e8", // Antarctica
            "#d14e5b", // Asia
            "#ffd336", // Europe
            "#4d824b", // North America
            "#a652ba", // Oceania
            "#69c487", // South America
            "#ff7f0e", "#1f77b4", "#ffbb78", "#2ca02c", "#98df8a", "#d62728", "#ff9896", "#9467bd", "#c5b0d5", "#8c564b", "c49c94", "e377c2", "f7b6d2", "7f7f7f", "c7c7c7", "bcbd22", "dbdb8d", "17becf", "9edae5", "1f77b4"]
    }

    @computed get colorScheme(): string[] {
        const { baseColorScheme } = this.chart
        const { colorDim } = this

        const colorScheme = baseColorScheme && ColorSchemes[baseColorScheme]
        if (!colorScheme) return this.defaultColors
        else if (!colorDim) return colorScheme.getColors(4)
        else return colorScheme.getColors(colorDim.variable.categoricalValues.length)
    }

    @computed get colorScale(): d3.ScaleOrdinal<string, string> {
        const colorDim = this.chart.data.dimensionsByField['color']

        const colorScale = scaleOrdinal(this.colorScheme)
        if (colorDim) {
            colorScale.domain(colorDim.variable.categoricalValues)
        }

        return colorScale
    }

    @computed get yTickFormat(): (d: number) => string {
        return this.yDimension ? this.yDimension.formatValueShort : d => `${d}`
    }

    @computed get data(): SlopeChartSeries[] {
        if (!this.yDimension) return []

        const { yDimension, xDomain, colorByEntity, sizeByEntity, chart } = this
        const entityKey = this.chart.vardata.entityMetaByKey

        const minYear = Math.max(xDomain[0])
        const maxYear = Math.min(xDomain[1])

        const entities = yDimension.entitiesUniq
        let data: SlopeChartSeries[] = entities.map(entity => {
            const slopeValues: SlopeChartValue[] = []
            const yValues = yDimension.valueByEntityAndYear.get(entity)
            if (yValues !== undefined) {
                yValues.forEach((value, year) => {
                    if (year === minYear || year === maxYear) {
                        slopeValues.push({
                            x: year,
                            y: typeof value === "string" ? parseInt(value) : value
                        })
                    }
                })
            }
            return {
                key: chart.data.keyFor(entity, yDimension.index),
                label: entityKey[entity].name,
                color: colorByEntity.get(entity) || "#ff7f0e",
                size: sizeByEntity.get(entity) || 1,
                values: slopeValues
            }
        })
        data = data.filter(d => d.values.length >= 2)
        return data
    }
}
