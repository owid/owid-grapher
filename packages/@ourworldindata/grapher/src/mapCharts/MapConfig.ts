import { observable, makeObservable } from "mobx"
import {
    GlobeConfig,
    MapRegionName,
    MapConfigInterface,
    TimeBound,
    EntityName,
} from "@ourworldindata/types"
import { ColorScaleConfig } from "../color/ColorScaleConfig"
import {
    ColumnSlug,
    Persistable,
    updatePersistables,
    objectWithPersistablesToObject,
    deleteRuntimeAndUnchangedProps,
    maxTimeBoundFromJSONOrPositiveInfinity,
    maxTimeToJSON,
    minTimeToJSON,
    trimObject,
    NoUndefinedValues,
    ToleranceStrategy,
    minTimeBoundFromJSONOrNegativeInfinity,
} from "@ourworldindata/utils"
import { MapSelectionArray } from "../selection/MapSelectionArray"
import { DEFAULT_GLOBE_ROTATION, DEFAULT_GLOBE_ZOOM } from "./MapChartConstants"
import * as R from "remeda"

// MapConfig holds the data and underlying logic needed by MapTab.
// It wraps the map property on ChartConfig.
// TODO: migrate database config & only pass legend props
class MapConfigDefaults {
    columnSlug: ColumnSlug | undefined = undefined
    time: TimeBound | undefined = undefined
    startTime: TimeBound | undefined = undefined
    timeTolerance: number | undefined = undefined
    toleranceStrategy: ToleranceStrategy | undefined = undefined
    hideTimeline: boolean | undefined = undefined
    region = MapRegionName.World

    globe: GlobeConfig = {
        isActive: false,
        rotation: DEFAULT_GLOBE_ROTATION, // specified as [lot, lan]
        zoom: DEFAULT_GLOBE_ZOOM,
    }

    colorScale = new ColorScaleConfig()
    // Show the label from colorSchemeLabels in the tooltip instead of the numeric value
    tooltipUseCustomLabels: boolean | undefined = undefined

    constructor() {
        makeObservable(this, {
            columnSlug: observable,
            time: observable,
            startTime: observable,
            timeTolerance: observable,
            toleranceStrategy: observable,
            hideTimeline: observable,
            region: observable,
            globe: observable,
            colorScale: observable,
            tooltipUseCustomLabels: observable,
        })
    }
}

export class MapConfig extends MapConfigDefaults implements Persistable {
    // Runtime-only state
    selection = new MapSelectionArray()
    hoverCountry?: EntityName

    updateFromObject(obj: Partial<MapConfigInterface>): void {
        updatePersistables(this, obj)

        this.time = maxTimeBoundFromJSONOrPositiveInfinity(obj.time)

        // If a start time is provided, use it; otherwise, set it to the end time
        // so that a single map (not a facetted one) is shown by default
        if (obj.startTime) {
            this.startTime = minTimeBoundFromJSONOrNegativeInfinity(
                obj.startTime
            )
        } else {
            this.startTime = this.time
        }

        // Map [lat, lon] to the internally used [lon, lat]
        if (obj.globe?.rotation) {
            this.globe = {
                ...this.globe,
                rotation: R.reverse(obj.globe.rotation),
            }
        }

        // Update selection
        if (obj.selectedEntityNames)
            this.selection.setSelectedEntities(obj.selectedEntityNames)
    }

    toObject(): NoUndefinedValues<MapConfigInterface> {
        const obj = objectWithPersistablesToObject(this) as MapConfigInterface
        deleteRuntimeAndUnchangedProps(obj, new MapConfigDefaults())

        if (obj.time) obj.time = maxTimeToJSON(this.time) as any
        if (obj.startTime) obj.startTime = minTimeToJSON(this.startTime) as any

        // No need to store the startTime if it's the same as the end time
        if (obj.startTime === obj.time) delete obj.startTime

        // Persist selection
        obj.selectedEntityNames = this.selection.selectedEntityNames

        // Don't persist globe settings if the globe isn't active
        if (!obj.globe?.isActive) delete obj.globe

        // Round rotation coordinates before persisting
        if (obj.globe?.rotation)
            obj.globe = {
                ...obj.globe,
                rotation: [
                    // we use [lon, lat] internally, but persist [lat, lon]
                    R.round(obj.globe.rotation[1], 2),
                    R.round(obj.globe.rotation[0], 2),
                ],
            }

        // Round zoom level before persisting
        if (obj.globe?.zoom) {
            obj.globe = {
                ...obj.globe,
                zoom: R.round(obj.globe.zoom, 2),
            }
        }

        return trimObject(obj)
    }

    constructor(obj?: Partial<MapConfigInterface>) {
        super()
        makeObservable(this, {
            selection: observable,
            hoverCountry: observable,
        })
        if (obj) this.updateFromObject(obj)
    }

    isContinentActive(): this is MapConfigWithActiveContinent {
        return this.region !== MapRegionName.World
    }

    is2dContinentActive(): this is MapConfigWithActiveContinent {
        return this.isContinentActive() && !this.globe.isActive
    }
}

type MapConfigWithActiveContinent = MapConfig & {
    region: Exclude<MapRegionName, "World">
}
