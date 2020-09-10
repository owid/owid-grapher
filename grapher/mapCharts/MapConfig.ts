import { observable } from "mobx"
import { MapProjection } from "./MapProjections"
import { PersistableColorScaleConfig } from "grapher/color/ColorScaleConfig"
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
class MapConfig {
    @observable columnSlug?: ColumnSlug
    @observable.ref targetYear?: number
    @observable.ref timeTolerance?: number
    @observable.ref hideTimeline?: true
    @observable.ref projection: MapProjection = "World"

    @observable colorScale = new PersistableColorScaleConfig()
    // Show the label from colorSchemeLabels in the tooltip instead of the numeric value
    @observable.ref tooltipUseCustomLabels?: true = undefined
}

export type MapConfigInterface = MapConfig

interface MapConfigWithLegacyInterface extends MapConfigInterface {
    variableId?: LegacyVariableId
}

export class PersistableMapConfig extends MapConfig implements Persistable {
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
        deleteRuntimeAndUnchangedProps<MapConfigInterface>(obj, new MapConfig())

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
