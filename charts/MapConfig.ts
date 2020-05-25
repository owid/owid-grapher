import { observable, computed } from "mobx"
import { MapProjection } from "./MapProjection"
import { ChartConfig } from "./ChartConfig"
import { MapData } from "./MapData"
import { defaultTo } from "./Util"
import { TimeBound, TimeBoundValue } from "./TimeBounds"
import { ColorLegendConfigProps } from "./ColorLegendConfig"

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
        this.legend = new ColorLegendConfigProps(json)

        if (json !== undefined) {
            for (const key in this) {
                if (key in json) {
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
    @computed get minBucketValue() {
        return +defaultTo(this.props.legend.colorSchemeMinValue, 0)
    }
    @computed get colorSchemeValues() {
        return defaultTo(this.props.legend.colorSchemeValues, [])
    }
    @computed get isCustomColors() {
        return defaultTo(this.props.legend.customColorsActive, false)
    }
    @computed get customNumericColors() {
        return defaultTo(
            this.isCustomColors ? this.props.legend.customNumericColors : [],
            []
        )
    }
    @computed get customCategoryColors(): { [key: string]: string } {
        return defaultTo(
            this.isCustomColors ? this.props.legend.customCategoryColors : {},
            {}
        )
    }
    @computed get customHiddenCategories(): { [key: string]: true } {
        return defaultTo(this.props.legend.customHiddenCategories, {})
    }
    @computed get isColorSchemeInverted() {
        return defaultTo(this.props.legend.colorSchemeInvert, false)
    }
    @computed get customCategoryLabels(): { [key: string]: string } {
        return defaultTo(this.props.legend.customCategoryLabels, {})
    }
    @computed get projection() {
        return defaultTo(this.props.projection, "World")
    }

    @computed get baseColorScheme() {
        return defaultTo(this.props.legend.baseColorScheme, "BuGn")
    }
    @computed get noDataColor() {
        return defaultTo(this.customCategoryColors["No data"], "#eee")
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
