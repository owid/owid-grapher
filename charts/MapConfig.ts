import { observable, computed } from "mobx"

import { MapProjection } from "./MapProjection"
import { ChartConfig } from "./ChartConfig"
import { MapData } from "./MapData"
import { defaultTo } from "./Util"
import { TimeBound, TimeBoundValue } from "./TimeBounds"
import { ColorLegendConfigProps } from "./ColorLegendConfig"
import { ColorLegendTransform } from "./ColorLegendTransform"

// MapConfig holds the data and underlying logic needed by MapTab.
// It wraps the map property on ChartConfig.
export class MapConfigProps {
    @observable.ref variableId?: number
    @observable.ref targetYear?: number
    @observable.ref timeTolerance?: number
    @observable.ref hideTimeline?: true
    @observable.ref projection: MapProjection = "World"

    @observable legend: ColorLegendConfigProps
    // Show the label from colorSchemeLabels in the tooltip instead of the numeric value
    @observable.ref tooltipUseCustomLabels?: true = undefined

    constructor(json?: Partial<MapConfigProps & ColorLegendConfigProps>) {
        // TODO: migrate database config & only pass legend props
        this.legend = new ColorLegendConfigProps(
            json?.legend ? json.legend : json
        )

        if (json !== undefined) {
            for (const key in this) {
                // `legend` is passed separately
                if (key in json && key !== "legend") {
                    this[key] = (json as any)[key]
                }
            }
        }
    }
}

export class MapConfig {
    chart: ChartConfig

    get props() {
        return this.chart.props.map
    }

    @computed get variableId() {
        return this.props.variableId
    }

    @computed get tolerance() {
        return defaultTo(this.props.timeTolerance, 0)
    }

    @computed get projection() {
        return defaultTo(this.props.projection, "World")
    }

    @computed get legend(): ColorLegendTransform {
        const that = this
        return new ColorLegendTransform(this.props.legend, {
            get minPossibleValue() {
                return that.data.minPossibleValue
            },
            get maxPossibleValue() {
                return that.data.maxPossibleValue
            },
            get defaultColorScheme() {
                return that.data.defaultColorScheme
            },
            get sortedNumericValues() {
                return that.data.sortedNumericValues
            },
            get categoricalValues() {
                return that.data.categoricalValues
            },
            get formatValue() {
                return that.data.formatValueShort
            }
        })
    }

    @computed get data() {
        return new MapData(this.chart)
    }

    @computed get targetYear(): TimeBound {
        return this.props.targetYear ?? TimeBoundValue.unboundedRight
    }

    set targetYear(value: TimeBound) {
        this.props.targetYear = value
    }

    @computed get tooltipUseCustomLabels() {
        return this.props.tooltipUseCustomLabels ?? false
    }

    constructor(chart: ChartConfig) {
        this.chart = chart
    }
}
