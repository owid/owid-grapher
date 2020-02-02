import { computed } from "mobx"
import { ChartConfig } from "./ChartConfig"
import { Colorable, Colorizer } from "./Colorizer"
import { DimensionWithData } from "./DimensionWithData"
import { IChartTransform } from "./IChartTransform"
import { SlopeChartSeries, SlopeChartValue } from "./LabelledSlopes"
import { find, isEmpty, max, min, some, union } from "./Util"
import { defaultTo, defaultWith, findClosest } from "./Util"

// Responsible for translating chart configuration into the form
// of a line chart
export class SlopeChartTransform implements IChartTransform {
    chart: ChartConfig

    constructor(chart: ChartConfig) {
        this.chart = chart
    }

    @computed get isValidConfig(): boolean {
        return this.chart.dimensions.some(d => d.property === "y")
    }

    @computed get failMessage(): string | undefined {
        const { filledDimensions } = this.chart.data
        if (!some(filledDimensions, d => d.property === "y"))
            return "Missing Y axis variable"
        else if (isEmpty(this.data)) return "No matching data"
        else return undefined
    }

    @computed get colorKeys(): string[] {
        const { colorDimension } = this
        return colorDimension ? colorDimension.variable.categoricalValues : []
    }

    @computed get colors(): Colorizer {
        const that = this
        return new Colorizer({
            get chart() {
                return that.chart
            },
            get defaultColorScheme() {
                return "continents"
            },
            get keys() {
                return that.colorKeys
            }
        })
    }

    @computed get colorables(): Colorable[] {
        return this.colors.colorables
    }

    @computed get timelineYears(): number[] {
        return union(
            ...this.chart.data.axisDimensions.map(d => d.variable.yearsUniq)
        )
    }

    @computed get minTimelineYear(): number {
        return defaultTo(min(this.timelineYears), 1900)
    }

    @computed get maxTimelineYear(): number {
        return defaultTo(max(this.timelineYears), 2000)
    }

    @computed get hasTimeline(): boolean {
        return (
            this.minTimelineYear !== this.maxTimelineYear &&
            this.timelineYears.length > 2 &&
            !this.chart.props.hideTimeline
        )
    }

    @computed get startYear(): number {
        const minYear = defaultWith(
            this.chart.timeDomain[0],
            () => this.minTimelineYear
        )
        return defaultWith(
            findClosest(this.timelineYears, minYear),
            () => this.minTimelineYear
        )
    }

    @computed get endYear(): number {
        const maxYear = defaultWith(
            this.chart.timeDomain[1],
            () => this.maxTimelineYear
        )
        return defaultWith(
            findClosest(this.timelineYears, maxYear),
            () => this.maxTimelineYear
        )
    }

    @computed.struct get xDomain(): [number, number] {
        return [this.startYear, this.endYear]
    }

    @computed.struct get sizeDim(): DimensionWithData | undefined {
        return find(
            this.chart.data.filledDimensions,
            d => d.property === "size"
        )
    }

    @computed.struct get colorDimension(): DimensionWithData | undefined {
        return this.chart.data.filledDimensions.find(
            d => d.property === "color"
        )
    }

    @computed.struct get yDimension(): DimensionWithData | undefined {
        return find(this.chart.data.filledDimensions, d => d.property === "y")
    }

    // helper method to directly get the associated color value given an Entity
    // dimension data saves color a level deeper. eg: { Afghanistan => { 2015: Asia|Color }}
    // this returns that data in the form { Afghanistan => Asia }
    @computed get colorByEntity(): Map<string, any> {
        const { colorDimension, colors } = this
        const colorByEntity = new Map<string, any>()

        if (colorDimension !== undefined) {
            colorDimension.valueByEntityAndYear.forEach(
                (yearToColorMap, entity) => {
                    const values = Array.from(yearToColorMap.values())
                    const key = values[0].toString()
                    colorByEntity.set(entity, colors.get(key))
                }
            )
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

    @computed get yTickFormat(): (d: number) => string {
        return this.yDimension ? this.yDimension.formatValueShort : d => `${d}`
    }

    @computed get selectableKeys(): string[] {
        const { data } = this

        const keyData: string[] = []
        data.forEach(series => {
            keyData.push(series.key)
        })
        return keyData
    }

    @computed get data(): SlopeChartSeries[] {
        if (!this.yDimension) return []

        const { yDimension, xDomain, colorByEntity, sizeByEntity, chart } = this
        const { keyColors } = chart.data
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
                            y:
                                typeof value === "string"
                                    ? parseInt(value)
                                    : value
                        })
                    }
                })
            }

            const key = chart.data.keyFor(entity, yDimension.index)
            return {
                key: key,
                label: entityKey[entity].name,
                color: keyColors[key] || colorByEntity.get(entity) || "#ff7f0e",
                size: sizeByEntity.get(entity) || 1,
                values: slopeValues
            }
        })
        data = data.filter(d => d.values.length >= 2)
        return data
    }
}
