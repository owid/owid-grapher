import { observable, toJS } from "mobx"
import { MapProjection } from "./MapProjections"
import {
    ColorScaleConfig,
    PersistableColorScaleConfig
} from "grapher/color/ColorScaleConfig"
import { owidVariableId } from "owidTable/OwidTable"
import { Persistable, updatePersistables } from "grapher/core/Persistable"
import { extend } from "grapher/utils/Util"
import { maxTimeFromJSON, maxTimeToJSON } from "grapher/utils/TimeBounds"

// MapConfig holds the data and underlying logic needed by MapTab.
// It wraps the map property on ChartConfig.
// TODO: migrate database config & only pass legend props
export class MapConfig {
    @observable.ref variableId?: owidVariableId
    @observable.ref targetYear?: number
    @observable.ref timeTolerance?: number
    @observable.ref hideTimeline?: true
    @observable.ref projection: MapProjection = "World"

    @observable colorScale = new PersistableColorScaleConfig()
    // Show the label from colorSchemeLabels in the tooltip instead of the numeric value
    @observable.ref tooltipUseCustomLabels?: true = undefined
}

export class PersistableMapConfig extends MapConfig implements Persistable {
    updateFromObject(obj: any) {
        extend(this, obj)
        this.targetYear = maxTimeFromJSON(this.targetYear)
    }

    toObject() {
        const obj = toJS(this)
        if (obj.targetYear)
            obj.targetYear = maxTimeToJSON(this.targetYear) as any

        return obj
    }

    constructor(obj?: Partial<ColorScaleConfig>) {
        super()
        updatePersistables(this, obj)
    }
}
