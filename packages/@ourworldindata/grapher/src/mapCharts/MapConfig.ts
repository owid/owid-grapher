import { observable, makeObservable } from "mobx"
import {
    GlobeConfig,
    MapRegionName,
    MapConfigInterface,
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
    trimObject,
    NoUndefinedValues,
    ToleranceStrategy,
} from "@ourworldindata/utils"
import { MapSelectionArray } from "../selection/MapSelectionArray"
import { DEFAULT_GLOBE_ROTATION, DEFAULT_GLOBE_ZOOM } from "./MapChartConstants"
import * as R from "remeda"

// MapConfig holds the data and underlying logic needed by MapTab.
// It wraps the map property on ChartConfig.
// TODO: migrate database config & only pass legend props
class MapConfigDefaults {
    @observable columnSlug?: ColumnSlug
    @observable time?: number
    @observable timeTolerance?: number
    @observable toleranceStrategy?: ToleranceStrategy
    @observable hideTimeline?: boolean

    @observable region = MapRegionName.World
    @observable selection = new MapSelectionArray()

    @observable globe: GlobeConfig = {
        isActive: false,
        rotation: DEFAULT_GLOBE_ROTATION, // specified as [lot, lan]
        zoom: DEFAULT_GLOBE_ZOOM,
    }

    @observable colorScale = new ColorScaleConfig()
    // Show the label from colorSchemeLabels in the tooltip instead of the numeric value
    @observable tooltipUseCustomLabels?: boolean = undefined

    constructor() {
        makeObservable(this)
    }
}

export class MapConfig extends MapConfigDefaults implements Persistable {
    updateFromObject(obj: Partial<MapConfigInterface>): void {
        updatePersistables(this, obj)

        if (obj.time)
            this.time = maxTimeBoundFromJSONOrPositiveInfinity(obj.time)

        // If the region is set, automatically switch to the globe
        if (obj.region && obj.region !== MapRegionName.World) {
            // Setting this.globe.isActive directly sometimes gives a MobX error
            this.globe = { ...this.globe, isActive: true }
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

        // persist selection
        obj.selectedEntityNames = this.selection.selectedEntityNames
        // @ts-expect-error hack to prevent selection from being persisted
        delete obj.selection

        // if a continent is given, then it defines the globe rotation & zoom,
        // so there is no need to also persist the globe settings
        if (obj.region && obj.region !== MapRegionName.World) delete obj.globe

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
}
