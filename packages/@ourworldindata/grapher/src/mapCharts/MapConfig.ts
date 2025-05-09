import { observable } from "mobx"
import { EntityName, MapRegionName } from "@ourworldindata/types"
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
import { DEFAULT_VIEWPORT } from "./MapChartConstants"

export interface GlobeConfig {
    isActive: boolean
    rotation: [number, number]
    zoom: number
    focusCountry?: EntityName
}

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

    @observable globe: GlobeConfig = {
        isActive: false,
        rotation: DEFAULT_VIEWPORT.rotation,
        zoom: 1,
    }

    @observable colorScale = new ColorScaleConfig()
    // Show the label from colorSchemeLabels in the tooltip instead of the numeric value
    @observable tooltipUseCustomLabels?: boolean = undefined
}

export type MapConfigInterface = MapConfigDefaults

export class MapConfig extends MapConfigDefaults implements Persistable {
    updateFromObject(obj: Partial<MapConfigInterface>): void {
        updatePersistables(this, obj)

        if (obj.time)
            this.time = maxTimeBoundFromJSONOrPositiveInfinity(obj.time)
    }

    toObject(): NoUndefinedValues<MapConfigInterface> {
        const obj = objectWithPersistablesToObject(this) as MapConfigInterface
        deleteRuntimeAndUnchangedProps(obj, new MapConfigDefaults())

        if (obj.time) obj.time = maxTimeToJSON(this.time) as any

        return trimObject(obj)
    }

    constructor(obj?: Partial<MapConfigInterface>) {
        super()
        if (obj) this.updateFromObject(obj)
    }
}
