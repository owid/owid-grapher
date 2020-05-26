import { computed, autorun, runInAction } from "mobx"

import { ChartConfig } from "./ChartConfig"
import { ColorSchemes, ColorScheme } from "./ColorSchemes"
import { Color } from "./Color"
import { ChoroplethData } from "./ChoroplethMap"
import { ChartDimensionWithOwidVariable } from "./ChartDimensionWithOwidVariable"
import { MapTopology } from "./MapTopology"

import {
    isString,
    findClosestYear,
    keys,
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

    contains(value: string | number | undefined): boolean {
        if (value === undefined) {
            return false
        } else if (this.props.isOpenLeft) {
            return value <= this.max
        } else if (this.props.isOpenRight) {
            return value > this.min
        } else if (this.props.isFirst) {
            return value >= this.min && value <= this.max
        } else {
            return value > this.min && value <= this.max
        }
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

    contains(value: string | number | undefined): boolean {
        return (
            (value === undefined && this.value === "No data") ||
            (value !== undefined && value === this.value)
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

    @computed get defaultColorScheme(): ColorScheme {
        return ColorSchemes[keys(ColorSchemes)[0]] as ColorScheme
    }

    @computed get legendData(): (NumericBin | CategoricalBin)[] {
        return this.map.legend.legendData
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
            const bin = find(legendData, b => b.contains(datum.value))
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
            ? this.map.legend.customBucketLabels
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
