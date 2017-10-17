import { observable, computed, toJS } from 'mobx'
import MapProjection from './MapProjection'
import Chart from './ChartConfig'
import MapData from './MapData'
import { defaultTo } from './Util'
import Color from './Color'

// MapConfig holds the data and underlying logic needed by MapTab.
// It wraps the map property on ChartConfig.
export class MapConfigProps {
    @observable.ref variableId?: number
    @observable.ref targetYear?: number
    @observable.ref timeTolerance?: number
    @observable.ref hideTimeline?: true
    // Key for a colorbrewer scheme, may then be further customized
    @observable.ref baseColorScheme?: string
    // Number of numeric intervals used to color data
    @observable.ref colorSchemeInterval?: number = 10
    // Minimum value shown on map legend
    @observable.ref colorSchemeMinValue?: number = undefined
    @observable.struct colorSchemeValues: (number | undefined)[] = []
    @observable.struct colorSchemeLabels: (string | undefined)[] = []
    @observable.ref isManualBuckets?: true = undefined
    @observable.ref equalSizeBins?: true = undefined
    // Whether to reverse the color scheme on output
    @observable.ref colorSchemeInvert?: true = undefined
    @observable.ref customColorsActive?: true = undefined
    // e.g. ["#000", "#c00", "#0c0", "#00c", "#c0c"]
    @observable.struct customNumericColors: (Color | undefined)[] = []
    // e.g. { 'foo' => '#c00' }
    @observable.ref customCategoryColors: { [key: string]: string } = {}
    @observable.ref customCategoryLabels: { [key: string]: string } = {}

    // Allow hiding categories from the legend
    @observable.ref customHiddenCategories: { [key: string]: true } = {}
    @observable.ref projection: MapProjection = 'World'
    @observable.ref defaultProjection: MapProjection = 'World'

    @observable.ref legendDescription?: string = undefined
    @observable.ref legendStepSize: number = 20

    constructor(json?: any) {
        if (json !== undefined) {
            for (const key in this) {
                if (key in json) {
                    (this as any)[key] = (json as any)[key]
                }
            }
        }
    }
}

export default class MapConfig {
    chart: Chart

    get props() {
        return (this.chart.props.map as MapConfigProps)
    }

    @computed get variableId() { return this.props.variableId }
    @computed get tolerance() { return defaultTo(this.props.timeTolerance, 0) }
    @computed get numBuckets() { return defaultTo(this.props.colorSchemeInterval, 10) }
    @computed get isAutoBuckets() { return !this.props.isManualBuckets }
    @computed get minBucketValue() { return +defaultTo(this.props.colorSchemeMinValue, 0) }
    @computed get colorSchemeValues() { return defaultTo(this.props.colorSchemeValues, []) }
    @computed get isCustomColors() { return defaultTo(this.props.customColorsActive, false) }
    @computed get customNumericColors() { return defaultTo(this.isCustomColors ? this.props.customNumericColors : [], []) }
    @computed get customCategoryColors(): { [key: string]: string } { return defaultTo(this.isCustomColors ? this.props.customCategoryColors : {}, {}) }
    @computed get customHiddenCategories(): { [key: string]: true } { return defaultTo(this.props.customHiddenCategories, {}) }
    @computed get isColorSchemeInverted() { return defaultTo(this.props.colorSchemeInvert, false) }
    @computed get customCategoryLabels(): { [key: string]: string } { return defaultTo(this.props.customCategoryLabels, {}) }
    @computed get customBucketLabels() {
        const labels = toJS(this.props.colorSchemeLabels) || []
        while (labels.length < this.numBuckets)
            labels.push(undefined)
        return labels
    }
    @computed get projection() { return defaultTo(this.props.projection, "World") }

    @computed get baseColorScheme() { return defaultTo(this.props.baseColorScheme, "BuGn") }
    @computed get noDataColor() {
        return defaultTo(this.customCategoryColors['No data'], "#adacac")
    }

    @computed get data() {
        return new MapData(this.chart)
    }

    set targetYear(value: number) {
        this.props.targetYear = value
    }

    constructor(chart: Chart) {
        this.chart = chart
    }
}
