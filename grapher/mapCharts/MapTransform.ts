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
import {
    isUnboundedLeft,
    isUnboundedRight,
    getClosestTime,
} from "grapher/utils/TimeBounds"

interface MapDataValue {
    entity: string
    value: number | string
    time: number
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

    private static _countryNamesWithMapSvg: Set<string>
    private static get countryNamesWithMapSvg() {
        // Cache the result
        if (!this._countryNamesWithMapSvg)
            this._countryNamesWithMapSvg = new Set(
                MapTopology.objects.world.geometries.map(
                    (region: any) => region.id
                )
            )
        return this._countryNamesWithMapSvg
    }

    // Figure out which entities in the variable can be shown on the map
    // (we can't render data for things that aren't countries)

    // Reverse lookup of map ids => data entities
    @computed get mapToDataEntities(): { [id: string]: string } {
        if (!this.dimension) return {}

        const entities: { [id: string]: string } = {}
        for (const entity of this.dimension.entityNamesUniq) {
            entities[entityNameForMap(entity)] = entity
        }
        return entities
    }

    // Filter data to what can be display on the map (across all times)
    @computed private get mappableData() {
        const { dimension } = this

        const mappableData: {
            times: number[]
            entities: string[]
            values: (number | string)[]
        } = {
            times: [],
            entities: [],
            values: [],
        }

        if (!dimension) return mappableData

        for (let i = 0; i < dimension.times.length; i++) {
            const entity = dimension.entityNames[i]
            if (!MapTransform.countryNamesWithMapSvg.has(entity)) continue

            mappableData.entities.push(entity)
            mappableData.times.push(dimension.times[i])
            mappableData.values.push(dimension.values[i])
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

    // All available times with data for the map
    @computed get availableTimes(): Time[] {
        return this.mappableData.times
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

    // Get values for the current time, without any color info yet
    @computed private get valuesByEntity(): { [key: string]: MapDataValue } {
        const { endTimelineTime, grapher } = this
        const valueByEntityAndTime = this.dimension?.valueByEntityAndTime

        if (endTimelineTime === undefined || !valueByEntityAndTime) return {}

        const tolerance = this.props.timeTolerance ?? 0
        const entityNames = this.dimension
            ? this.dimension.entityNamesUniq.filter((name) =>
                  MapTransform.countryNamesWithMapSvg.has(name)
              )
            : []

        const result: { [key: string]: MapDataValue } = {}

        const selectedEntityNames = new Set(grapher.selectedEntityNames)

        entityNames.forEach((entity) => {
            const valueByTime = valueByEntityAndTime.get(entity)
            if (!valueByTime) return
            const times = Array.from(valueByTime.keys())
            const time = findClosestTime(times, endTimelineTime, tolerance)
            if (time === undefined) return
            const value = valueByTime.get(time)
            if (value === undefined) return
            result[entity] = {
                entity,
                time,
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

    @computed private get targetTimelineTime(): Time {
        const time = this.props.time ?? 2000

        if (isUnboundedLeft(time)) return this.minTimelineTime
        else if (isUnboundedRight(time)) return this.maxTimelineTime

        return getClosestTime(this.timelineTimes, time, this.minTimelineTime)
    }

    @computed get startTimelineTime(): Time {
        return this.targetTimelineTime
    }

    @computed get endTimelineTime(): Time {
        return this.targetTimelineTime
    }
}
