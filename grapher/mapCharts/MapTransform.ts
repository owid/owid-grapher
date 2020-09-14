import { computed } from "mobx"
import {
    isString,
    findClosestTime,
    keyBy,
    isNumber,
    entityNameForMap,
    uniq,
    sortNumeric,
} from "grapher/utils/Util"

import { ChoroplethData } from "grapher/mapCharts/ChoroplethMap"
import { MapTopology } from "./MapTopology"

import { ChartTransform } from "grapher/chart/ChartTransform"
import { ColorScale } from "grapher/color/ColorScale"
import { Time } from "grapher/core/GrapherConstants"

interface MapDataValue {
    entity: string
    value: number | string
    year: number
    isSelected?: boolean
}

export class MapTransform extends ChartTransform {
    get props() {
        return this.grapher.map
    }

    @computed get columnSlug() {
        const grapher = this.grapher
        return this.props.columnSlug &&
            grapher.table.columnsBySlug.get(this.props.columnSlug)
            ? this.props.columnSlug
            : grapher.primaryColumnSlug
    }

    @computed get projection() {
        return this.props.projection ?? "World"
    }

    @computed get hasTimeline() {
        // Maps have historically had an independent property to hide the timeline.
        // The config objects in the database still have this property, though we have not yet run
        // into a case where the timeline needs to be shown
        return (
            this.timelineTimes.length > 1 &&
            !this.grapher.hideTimeline &&
            !this.props.hideTimeline
        )
    }

    // Make sure map has an assigned variable and the data is ready
    @computed get isReady() {
        return (
            !!this.columnSlug &&
            this.grapher.table.columnsBySlug.has(this.columnSlug)
        )
    }

    @computed get dimension() {
        return this.grapher.filledDimensions.find(
            (d) => d.columnSlug === this.columnSlug
        )
    }

    // Figure out which entities in the variable can be shown on the map
    // (we can't render data for things that aren't countries)
    @computed private get knownMapEntities(): { [entity: string]: string } {
        if (!this.dimension) return {}

        const idLookup = keyBy(
            MapTopology.objects.world.geometries.map((g: any) => g.id)
        )
        const entities = this.dimension.entityNamesUniq.filter(
            (e) => !!idLookup[entityNameForMap(e)]
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
    @computed private get mappableData() {
        const { dimension } = this

        const mappableData: {
            years: number[]
            entities: string[]
            values: (number | string)[]
        } = {
            years: [],
            entities: [],
            values: [],
        }

        if (dimension) {
            const { knownMapEntities } = this
            for (let i = 0; i < dimension.times.length; i++) {
                const year = dimension.times[i]
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

    @computed get sortedNumericValues() {
        return sortNumeric(
            this.mappableData.values.filter(isNumber).filter((v) => !isNaN(v))
        )
    }

    @computed get categoricalValues() {
        return uniq(this.mappableData.values.filter(isString))
    }

    // All available years with data for the map
    @computed get availableTimes(): Time[] {
        const { mappableData } = this
        return mappableData.years.filter(
            (_, i) => !!this.knownMapEntities[mappableData.entities[i]]
        )
    }

    @computed get colorScale() {
        const that = this
        return new ColorScale({
            get config() {
                return that.props.colorScale
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
            get formatNumericValueFn() {
                return that.dimension?.formatValueShortFn || ((val: any) => "")
            },
        })
    }

    // Get values for the current year, without any color info yet
    @computed private get valuesByEntity(): { [key: string]: MapDataValue } {
        const { endTimelineTime, grapher } = this
        const valueByEntityAndYear = this.dimension?.valueByEntityAndTime

        if (endTimelineTime === undefined || !valueByEntityAndYear) return {}

        const tolerance = this.props.timeTolerance ?? 0
        const entities = Object.keys(this.knownMapEntities)

        const result: { [key: string]: MapDataValue } = {}

        const selectedEntityNames = new Set(grapher.selectedEntityNames)

        entities.forEach((entity) => {
            const valueByYear = valueByEntityAndYear.get(entity)
            if (!valueByYear) return
            const years = Array.from(valueByYear.keys())
            const year = findClosestTime(years, endTimelineTime, tolerance)
            if (year === undefined) return
            const value = valueByYear.get(year)
            if (value === undefined) return
            result[entity] = {
                entity,
                year,
                value,
                isSelected: selectedEntityNames.has(entity),
            }
        })

        return result
    }

    // Get the final data incorporating the binning colors
    @computed get choroplethData() {
        const { valuesByEntity } = this
        const choroplethData: ChoroplethData = {}

        Object.entries(valuesByEntity).forEach(([entity, datum]) => {
            const color = this.colorScale.getColor(datum.value)
            if (color) {
                choroplethData[entity] = {
                    ...datum,
                    color: color,
                    highlightFillColor: color,
                }
            }
        })

        return choroplethData
    }

    @computed get formatTooltipValue(): (d: number | string) => string {
        const formatValueLong =
            this.dimension && this.dimension.formatValueLongFn
        const customLabels = this.props.tooltipUseCustomLabels
            ? this.colorScale.customNumericLabels
            : []
        return formatValueLong
            ? (d: number | string) => {
                  if (isString(d)) return d
                  else return customLabels[d] ?? formatValueLong(d)
              }
            : () => ""
    }
}
