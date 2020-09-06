import { observable, toJS } from "mobx"
import { MapProjection } from "./MapProjections"
import {
    ColorScaleConfig,
    PersistableColorScaleConfig
} from "charts/color/ColorScaleConfig"
import { owidVariableId } from "owidTable/OwidTable"
import { Persistable, updatePersistables } from "charts/core/Persistable"
import { extend } from "charts/utils/Util"
import { maxTimeFromJSON } from "charts/utils/TimeBounds"

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
        return toJS(this)
    }

    constructor(obj?: Partial<ColorScaleConfig>) {
        super()
        updatePersistables(this, obj)
    }
}
