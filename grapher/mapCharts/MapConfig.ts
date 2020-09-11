import { observable } from "mobx"
import { MapProjection } from "./MapProjections"
import { ColorScaleConfig } from "grapher/color/ColorScaleConfig"
import { ColumnSlug, LegacyVariableId } from "owidTable/OwidTableConstants"
import {
    Persistable,
    updatePersistables,
    objectWithPersistablesToObject,
    deleteRuntimeAndUnchangedProps,
} from "grapher/persistable/Persistable"
import { maxTimeFromJSON, maxTimeToJSON } from "grapher/utils/TimeBounds"

// MapConfig holds the data and underlying logic needed by MapTab.
// It wraps the map property on ChartConfig.
// TODO: migrate database config & only pass legend props
class MapConfigDefaults {
    @observable columnSlug?: ColumnSlug
    @observable.ref targetYear?: number
    @observable.ref timeTolerance?: number
    @observable.ref hideTimeline?: true
    @observable.ref projection: MapProjection = "World"

    @observable colorScale = new ColorScaleConfig()
    // Show the label from colorSchemeLabels in the tooltip instead of the numeric value
    @observable.ref tooltipUseCustomLabels?: true = undefined
}

export type MapConfigInterface = MapConfigDefaults

interface MapConfigWithLegacyInterface extends MapConfigInterface {
    variableId?: LegacyVariableId
}

export class MapConfig extends MapConfigDefaults implements Persistable {
    updateFromObject(obj: Partial<MapConfigWithLegacyInterface>) {
        if (obj.variableId && !obj.columnSlug)
            // Migrate variableIds to columnSlugs
            obj.columnSlug = obj.variableId.toString()
        updatePersistables(this, obj)
        if (obj.targetYear) this.targetYear = maxTimeFromJSON(obj.targetYear)
    }

    toObject() {
        const obj = objectWithPersistablesToObject(
            this
        ) as MapConfigWithLegacyInterface
        deleteRuntimeAndUnchangedProps(obj, new MapConfigDefaults())

        if (obj.targetYear)
            obj.targetYear = maxTimeToJSON(this.targetYear) as any

        if (obj.columnSlug) {
            // Restore variableId for legacy for now
            obj.variableId = parseInt(obj.columnSlug)
            delete obj.columnSlug
        }

        return obj
    }

    constructor(obj?: Partial<MapConfigWithLegacyInterface>) {
        super()
        if (obj) this.updateFromObject(obj)
    }
}
