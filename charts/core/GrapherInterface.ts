import {
    ChartTypeName,
    StackMode,
    GrapherTabOption,
    ScatterPointLabelStrategy,
    HighlightToggleConfig,
    Color,
    RelatedQuestionsConfig
} from "./GrapherConstants"
import { AxisOptionsInterface } from "charts/axis/Axis"
import { OwidVariablesAndEntityKey } from "owidTable/OwidVariable"
import {
    TimeBound,
    Time,
    minTimeToJSON,
    maxTimeToJSON
} from "charts/utils/TimeBounds"
import { ChartDimensionSpec } from "charts/chart/ChartDimension"
import { ComparisonLineConfig } from "charts/scatterCharts/ComparisonLine"
import { LogoOption } from "charts/chart/Logos"
import { ColorScaleConfigProps } from "charts/color/ColorScaleConfig"
import { MapConfig } from "charts/mapCharts/MapConfig"
import { observable, toJS } from "mobx"

interface EntitySelection {
    entityId: number
    index: number // Which dimension the entity is from
    color?: Color
}

type GrapherProperty = keyof GrapherInterface

// This configuration represents the entire persistent state of a grapher
// Ideally, this is also all of the interaction state: when a grapher is saved and loaded again
// under the same rendering conditions it ought to remain visually identical
export interface GrapherInterface {
    type?: ChartTypeName
    isExplorable?: boolean
    id?: number
    version?: number
    slug?: string
    title?: string
    subtitle?: string
    sourceDesc?: string
    note?: string
    hideTitleAnnotation?: true

    xAxis?: Partial<AxisOptionsInterface>
    yAxis?: Partial<AxisOptionsInterface>

    externalDataUrl?: string
    owidDataset?: OwidVariablesAndEntityKey
    useV2?: boolean

    selectedData?: EntitySelection[]
    minTime?: TimeBound
    maxTime?: TimeBound

    timelineMinTime?: Time
    timelineMaxTime?: Time

    dimensions?: ChartDimensionSpec[]
    addCountryMode?: "add-country" | "change-country" | "disabled"

    comparisonLines?: ComparisonLineConfig[]
    highlightToggle?: HighlightToggleConfig
    stackMode?: StackMode
    hideLegend?: true
    logo?: LogoOption
    hideLogo?: boolean
    hideRelativeToggle?: boolean
    entityType?: string
    entityTypePlural?: string
    hideTimeline?: true
    zoomToSelection?: true
    minPopulationFilter?: number

    // Always show year in labels for bar charts
    showYearLabels?: boolean

    hasChartTab?: boolean
    hasMapTab?: boolean
    tab?: GrapherTabOption
    overlay?: GrapherTabOption

    relatedQuestions?: RelatedQuestionsConfig[]
    internalNotes?: string
    variantName?: string
    originUrl?: string
    isPublished?: true

    baseColorScheme?: string
    invertColorScheme?: true

    // SCATTERPLOT-SPECIFIC OPTIONS

    colorScale?: Partial<ColorScaleConfigProps>

    hideLinesOutsideTolerance?: true

    // Hides lines between points when timeline spans multiple years. Requested by core-econ for certain charts
    hideConnectedScatterLines?: boolean
    scatterPointLabelStrategy?: ScatterPointLabelStrategy
    compareEndPointsOnly?: true
    matchingEntitiesOnly?: true
    excludedEntities?: number[]

    map?: Partial<MapConfig>
    data?: { availableEntities: string[] }
}

// Simply implements the *saveable* properties of Grapher. This class is only concerned with parsing and serializing.
export class GrapherScript implements GrapherInterface {
    @observable.ref type: ChartTypeName = "LineChart"
    @observable.ref isExplorable: boolean = false
    @observable.ref id?: number = undefined
    @observable.ref version: number = 1
    @observable.ref slug?: string = undefined
    @observable.ref title?: string = undefined
    @observable.ref subtitle?: string = ""
    @observable.ref sourceDesc?: string = undefined
    @observable.ref note?: string = ""
    @observable.ref hideTitleAnnotation?: true = undefined
    @observable.ref minTime?: TimeBound = undefined
    @observable.ref maxTime?: TimeBound = undefined
    @observable.ref timelineMinTime?: Time = undefined
    @observable.ref timelineMaxTime?: Time = undefined
    @observable.ref addCountryMode?:
        | "add-country"
        | "change-country"
        | "disabled" = "add-country"
    @observable.ref highlightToggle?: HighlightToggleConfig = undefined
    @observable.ref stackMode: StackMode = "absolute"
    @observable.ref hideLegend?: true = undefined
    @observable.ref logo?: LogoOption = undefined
    @observable.ref hideLogo?: boolean = undefined
    @observable.ref hideRelativeToggle?: boolean = true
    @observable.ref entityType?: string = "country"
    @observable.ref entityTypePlural?: string = "countries"
    @observable.ref hideTimeline?: true = undefined
    @observable.ref zoomToSelection?: true = undefined
    @observable.ref minPopulationFilter?: number = undefined
    @observable.ref showYearLabels?: boolean = undefined // Always show year in labels for bar charts
    @observable.ref hasChartTab: boolean = true
    @observable.ref hasMapTab: boolean = false
    @observable.ref tab: GrapherTabOption = "chart"
    @observable.ref overlay?: GrapherTabOption = undefined
    @observable.ref internalNotes?: string = ""
    @observable.ref variantName?: string = undefined
    @observable.ref originUrl: string = ""
    @observable.ref isPublished?: true = undefined
    @observable.ref baseColorScheme?: string = undefined
    @observable.ref invertColorScheme?: true = undefined
    @observable.ref hideLinesOutsideTolerance?: true = undefined
    @observable hideConnectedScatterLines?: boolean = undefined // Hides lines between points when timeline spans multiple years. Requested by core-econ for certain charts
    @observable
    scatterPointLabelStrategy?: ScatterPointLabelStrategy = undefined
    @observable.ref compareEndPointsOnly?: true = undefined
    @observable.ref matchingEntitiesOnly?: true = undefined

    @observable.ref xAxis: Partial<AxisOptionsInterface> = {}
    @observable.ref yAxis: Partial<AxisOptionsInterface> = {}
    @observable.ref selectedData: EntitySelection[] = []
    @observable.ref dimensions: ChartDimensionSpec[] = []
    @observable colorScale: Partial<ColorScaleConfigProps> = {}
    @observable excludedEntities?: number[] = undefined
    @observable map: Partial<MapConfig> = {}
    data?: { availableEntities: string[] } = undefined
    @observable comparisonLines?: ComparisonLineConfig[] = []
    @observable relatedQuestions?: RelatedQuestionsConfig[]

    externalDataUrl?: string
    owidDataset?: OwidVariablesAndEntityKey
    useV2?: boolean = false

    toJson(): GrapherInterface {
        const defaultJson: GrapherInterface = toJS(new GrapherScript())
        const json: GrapherInterface = toJS(this)
        const defaultKeys = new Set(Object.keys(defaultJson))

        // Never save the followingto the DB.
        delete json.externalDataUrl
        delete json.owidDataset
        delete json.useV2

        // Remove the overlay tab state (e.g. download or sources) in order to avoid saving charts
        // in the Grapher Admin with an overlay tab open
        delete json.overlay

        Object.keys(json).forEach(prop => {
            const key = prop as GrapherProperty
            const currentValue = JSON.stringify(json[key])
            const defaultValue = JSON.stringify(defaultJson[key])
            if (currentValue === defaultValue || !defaultKeys.has(key))
                delete json[key]
        })

        // JSON doesn't support Infinity, so we use strings instead.
        json.minTime = minTimeToJSON(this.minTime) as any
        json.maxTime = maxTimeToJSON(this.maxTime) as any

        return JSON.stringify(json) as GrapherInterface
    }

    fromJson(obj: GrapherInterface) {
        return this
    }
}
