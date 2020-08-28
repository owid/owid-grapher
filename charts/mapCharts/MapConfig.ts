import { observable } from "mobx"
import { MapProjection } from "./MapProjections"
import { ColorScaleConfigProps } from "charts/color/ColorScaleConfig"
import { owidVariableId } from "owidTable/OwidTable"

// MapConfig holds the data and underlying logic needed by MapTab.
// It wraps the map property on ChartConfig.
export class MapConfig {
    @observable.ref variableId?: owidVariableId
    @observable.ref targetYear?: number
    @observable.ref timeTolerance?: number
    @observable.ref hideTimeline?: true
    @observable.ref projection: MapProjection = "World"

    @observable colorScale: ColorScaleConfigProps
    // Show the label from colorSchemeLabels in the tooltip instead of the numeric value
    @observable.ref tooltipUseCustomLabels?: true = undefined

    constructor(json?: Partial<MapConfig & ColorScaleConfigProps>) {
        // TODO: migrate database config & only pass legend props
        this.colorScale = new ColorScaleConfigProps(json?.colorScale)

        if (json !== undefined) {
            for (const key in this) {
                // `colorScale` is passed separately
                if (key in json && key !== "legend") {
                    this[key] = (json as any)[key]
                }
            }
        }
    }
}
