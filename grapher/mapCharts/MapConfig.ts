import { observable, makeObservable } from "mobx"
import { MapProjectionName } from "./MapProjections.js"
import { ColorScaleConfig } from "../color/ColorScaleConfig.js"
import { ColumnSlug, OwidVariableId } from "../../clientUtils/owidTypes.js"
import {
    Persistable,
    updatePersistables,
    objectWithPersistablesToObject,
    deleteRuntimeAndUnchangedProps,
} from "../../clientUtils/persistable/Persistable.js"
import {
    maxTimeBoundFromJSONOrPositiveInfinity,
    maxTimeToJSON,
} from "../../clientUtils/TimeBounds.js"
import { trimObject, NoUndefinedValues } from "../../clientUtils/Util.js"

// MapConfig holds the data and underlying logic needed by MapTab.
// It wraps the map property on ChartConfig.
// TODO: migrate database config & only pass legend props
class MapConfigDefaults {
    columnSlug?: ColumnSlug
    time?: number
    timeTolerance?: number
    hideTimeline?: boolean
    projection = MapProjectionName.World

    colorScale = new ColorScaleConfig()
    // Show the label from colorSchemeLabels in the tooltip instead of the numeric value
    tooltipUseCustomLabels?: boolean = undefined

    constructor() {
        makeObservable(this, {
            columnSlug: observable,
            time: observable,
            timeTolerance: observable,
            hideTimeline: observable,
            projection: observable,
            colorScale: observable,
            tooltipUseCustomLabels: observable,
        })
    }
}

export type MapConfigInterface = MapConfigDefaults

export interface MapConfigWithLegacyInterface extends MapConfigInterface {
    variableId?: OwidVariableId
    targetYear?: number
}

export class MapConfig extends MapConfigDefaults implements Persistable {
    updateFromObject(obj: Partial<MapConfigWithLegacyInterface>): void {
        // Migrate variableIds to columnSlugs
        if (obj.variableId && !obj.columnSlug)
            obj.columnSlug = obj.variableId.toString()

        updatePersistables(this, obj)

        // Migrate "targetYear" to "time"
        // TODO migrate the database property instead
        if (obj.targetYear)
            this.time = maxTimeBoundFromJSONOrPositiveInfinity(obj.targetYear)
        else if (obj.time)
            this.time = maxTimeBoundFromJSONOrPositiveInfinity(obj.time)
    }

    toObject(): NoUndefinedValues<MapConfigWithLegacyInterface> {
        const obj = objectWithPersistablesToObject(
            this
        ) as MapConfigWithLegacyInterface
        deleteRuntimeAndUnchangedProps(obj, new MapConfigDefaults())

        if (obj.time) obj.time = maxTimeToJSON(this.time) as any

        if (obj.columnSlug) {
            // Restore variableId for legacy for now
            obj.variableId = parseInt(obj.columnSlug)
            delete obj.columnSlug
        }

        return trimObject(obj)
    }

    constructor(obj?: Partial<MapConfigWithLegacyInterface>) {
        super()
        if (obj) this.updateFromObject(obj)
    }
}
