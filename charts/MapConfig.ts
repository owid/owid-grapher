import { computed, observable } from "mobx"

import { ChartConfig } from "./ChartConfig"
import { Color } from "./Color"
import { MapData } from "./MapData"
import { MapProjection } from "./MapProjection"
import { defaultTo } from "./Util"

// MapConfig holds the data and underlying logic needed by MapTab.
// It wraps the map property on ChartConfig.
export class MapConfigProps {
    @observable.ref variableId?: number
    @observable.ref targetYear?: number
    @observable.ref timeTolerance?: number
    @observable.ref hideTimeline?: true
    // Key for a colorbrewer scheme, may then be further customized
    @observable.ref baseColorScheme?: string
    // Minimum value shown on map legend
    @observable.ref colorSchemeMinValue?: number
    @observable colorSchemeValues: number[] = []
    @observable colorSchemeLabels: (string | undefined)[] = []
    @observable.ref isManualBuckets?: true = undefined
    @observable.ref equalSizeBins?: true = undefined
    // Whether to reverse the color scheme on output
    @observable.ref colorSchemeInvert?: true = undefined
    @observable.ref customColorsActive?: true = undefined
    // e.g. ["#000", "#c00", "#0c0", "#00c", "#c0c"]
    @observable customNumericColors: (Color | undefined)[] = []
    // e.g. { 'foo' => '#c00' }
    @observable.ref customCategoryColors: { [key: string]: string } = {}
    @observable.ref customCategoryLabels: { [key: string]: string } = {}

    // Allow hiding categories from the legend
    @observable.ref customHiddenCategories: { [key: string]: true } = {}
    @observable.ref projection: MapProjection = "World"

    @observable.ref legendDescription?: string = undefined
    @observable.ref binStepSize?: number = undefined

    constructor(json?: any) {
        if (json !== undefined) {
            for (const key in this) {
                if (key in json) {
                    ;(this as any)[key] = (json as any)[key]
                }
            }
        }
    }
}

export class MapConfig {
    chart: ChartConfig

    get props() {
        return this.chart.props.map as MapConfigProps
    }

    @computed get variableId() {
        return this.props.variableId
    }
    @computed get tolerance() {
        return defaultTo(this.props.timeTolerance, 0)
    }
    @computed get minBucketValue() {
        return +defaultTo(this.props.colorSchemeMinValue, 0)
    }
    @computed get colorSchemeValues() {
        return defaultTo(this.props.colorSchemeValues, [])
    }
    @computed get isCustomColors() {
        return defaultTo(this.props.customColorsActive, false)
    }
    @computed get customNumericColors() {
        return defaultTo(
            this.isCustomColors ? this.props.customNumericColors : [],
            []
        )
    }
    @computed get customCategoryColors(): { [key: string]: string } {
        return defaultTo(
            this.isCustomColors ? this.props.customCategoryColors : {},
            {}
        )
    }
    @computed get customHiddenCategories(): { [key: string]: true } {
        return defaultTo(this.props.customHiddenCategories, {})
    }
    @computed get isColorSchemeInverted() {
        return defaultTo(this.props.colorSchemeInvert, false)
    }
    @computed get customCategoryLabels(): { [key: string]: string } {
        return defaultTo(this.props.customCategoryLabels, {})
    }
    @computed get projection() {
        return defaultTo(this.props.projection, "World")
    }

    @computed get baseColorScheme() {
        return defaultTo(this.props.baseColorScheme, "BuGn")
    }
    @computed get noDataColor() {
        return defaultTo(this.customCategoryColors["No data"], "#eee")
    }

    @computed get data() {
        return new MapData(this.chart)
    }

    set targetYear(value: number) {
        this.props.targetYear = value
    }

    constructor(chart: ChartConfig) {
        this.chart = chart
    }
}
