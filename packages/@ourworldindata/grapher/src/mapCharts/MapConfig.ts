import { observable, makeObservable } from "mobx"
import {
    GlobeConfig,
    MapRegionName,
    MapConfigInterface,
    TimeBound,
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
    startTime: TimeBound | undefined = undefined
    endTime: TimeBound | undefined = undefined
    timeTolerance: number | undefined = undefined
    toleranceStrategy: ToleranceStrategy | undefined = undefined
    hideTimeline: boolean | undefined = undefined

    region = MapRegionName.World
    selection = new MapSelectionArray()

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
            startTime: observable,
            endTime: observable,
            timeTolerance: observable,
            toleranceStrategy: observable,
            hideTimeline: observable,
            region: observable,
            selection: observable,
            globe: observable,
            colorScale: observable,
            tooltipUseCustomLabels: observable,
        })
    }
}

export class MapConfig extends MapConfigDefaults implements Persistable {
    updateFromObject(obj: Partial<MapConfigInterface>): void {
        updatePersistables(this, obj)

        this.endTime = maxTimeBoundFromJSONOrPositiveInfinity(obj.endTime)

        // If a start time is provided, use it; otherwise, set it to the end time
        // so that a single map (not a facetted one) is shown by default
        if (obj.startTime) {
            this.startTime = minTimeBoundFromJSONOrNegativeInfinity(
                obj.startTime
            )
        } else {
            this.startTime = this.endTime
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

        if (obj.startTime) obj.startTime = minTimeToJSON(this.startTime) as any
        if (obj.endTime) obj.endTime = maxTimeToJSON(this.endTime) as any

        // No need to store the startTime if it's the same as the endTime
        if (obj.startTime === obj.endTime) delete obj.startTime

        // persist selection
        obj.selectedEntityNames = this.selection.selectedEntityNames
        // @ts-expect-error hack to prevent selection from being persisted
        delete obj.selection

        // don't persist globe settings if the globe isn't active
        if (!obj.globe?.isActive) delete obj.globe

        // round rotation coordinates before persisting
        if (obj.globe?.rotation)
            obj.globe = {
                ...obj.globe,
                rotation: [
                    // we use [lon, lat] internally, but persist [lat, lon]
                    R.round(obj.globe.rotation[1], 2),
                    R.round(obj.globe.rotation[0], 2),
                ],
            }

        // round zoom level before persisting
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
