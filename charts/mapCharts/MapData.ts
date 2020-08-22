import { computed, autorun, runInAction } from "mobx"

import { ChartConfig } from "charts/ChartConfig"
import { ChoroplethData } from "charts/mapCharts/ChoroplethMap"
import { ChartDimension } from "charts/ChartDimension"
import { MapTopology } from "./MapTopology"

import {
    isString,
    findClosestYear,
    extend,
    each,
    keyBy,
    isNumber,
    sortBy,
    entityNameForMap,
    formatYear,
    uniq
} from "charts/Util"
import { Time, getClosestTime } from "charts/TimeBounds"
import { ChartTransform } from "charts/ChartTransform"
import { ColorScaleBin } from "charts/color/ColorScaleBin"
import { ColorScale } from "charts/color/ColorScale"

export interface MapDataValue {
    entity: string
    value: number | string
    year: number
    isSelected?: boolean
}

export class MapData extends ChartTransform {
    constructor(chart: ChartConfig) {
        super(chart)

        if (!chart.isNode) this.ensureValidConfig()
    }

    @computed get isValidConfig() {
        return !!this.chart.primaryVariableId
    }

    ensureValidConfig() {
        const { chart } = this

        // Validate the map variable id selection to something on the chart
        autorun(() => {
            const hasVariable =
                chart.map.variableId &&
                chart.table.columnsByOwidVarId.get(chart.map.variableId)
            if (!hasVariable && chart.primaryVariableId)
                runInAction(
                    () => (chart.map.props.variableId = chart.primaryVariableId)
                )
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
            !!this.chart.table.columnsByOwidVarId.get(map.variableId)
        )
    }

    @computed get dimension(): ChartDimension | undefined {
        return this.chart.filledDimensions.find(
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
        const entities = this.dimension.entityNamesUniq.filter(
            e => !!idLookup[entityNameForMap(e)]
        )
        return keyBy(entities)
    }

    // Reverse lookup of map ids => data entities
    @computed get mapToDataEntities(): { [id: string]: string } {
        if (!this.dimension) return {}

        const entities: { [id: string]: string } = {}
        for (const entity of this.dimension.entityNamesUniq) {
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
            this.mappableData.values.filter(isNumber).filter(v => !isNaN(v))
        )
    }

    @computed get formatValueShort() {
        return this.dimension ? this.dimension.formatValueShort : () => ""
    }

    @computed get categoricalValues(): string[] {
        return uniq(this.mappableData.values.filter(isString))
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

    @computed get colorScale(): ColorScale {
        const that = this
        return new ColorScale({
            get config() {
                return that.map.props.colorScale
            },
            get sortedNumericValues() {
                return that.sortedNumericValues
            },
            get categoricalValues() {
                return that.categoricalValues
            },
            get hasNoDataBin() {
                return true
            },
            get defaultBaseColorScheme() {
                return "BuGn"
            },
            get formatNumericValue() {
                return that.formatValueShort
            }
        })
    }

    @computed get legendData(): ColorScaleBin[] {
        return this.map.data.colorScale.legendData
    }

    // Get values for the current year, without any color info yet
    @computed get valuesByEntity(): { [key: string]: MapDataValue } {
        const { map, targetYear, chart } = this
        const valueByEntityAndYear = this.dimension?.valueByEntityAndYear

        if (targetYear === undefined || !valueByEntityAndYear) return {}

        const { tolerance } = map
        const entities = Object.keys(this.knownMapEntities)

        const result: { [key: string]: MapDataValue } = {}

        const selectedEntityNames = new Set(chart.data.selectedEntityNames)

        entities.forEach(entity => {
            const valueByYear = valueByEntityAndYear.get(entity)
            if (!valueByYear) return
            const years = Array.from(valueByYear.keys())
            const year = findClosestYear(years, targetYear, tolerance)
            if (year === undefined) return
            const value = valueByYear.get(year)
            if (value === undefined) return
            result[entity] = {
                entity,
                year,
                value,
                isSelected: selectedEntityNames.has(entity)
            }
        })

        return result
    }

    // Get the final data incorporating the binning colors
    @computed get choroplethData(): ChoroplethData {
        const { valuesByEntity } = this
        const choroplethData: ChoroplethData = {}

        each(valuesByEntity, (datum, entity) => {
            const color = this.colorScale.getColor(datum.value)
            if (color) {
                choroplethData[entity] = extend({}, datum, {
                    color: color,
                    highlightFillColor: color
                })
            }
        })

        return choroplethData
    }

    @computed get formatTooltipValue(): (d: number | string) => string {
        const formatValueLong = this.dimension && this.dimension.formatValueLong
        const customLabels = this.map.tooltipUseCustomLabels
            ? this.map.data.colorScale.customNumericLabels
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
