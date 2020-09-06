import {
    ChartTypeName,
    StackMode,
    GrapherTabOption,
    ScatterPointLabelStrategy,
    HighlightToggleConfig,
    Color,
    RelatedQuestionsConfig,
    AddCountryMode
} from "./GrapherConstants"
import { AxisOptionsInterface, AxisOptions } from "charts/axis/AxisOptions"
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
import {
    ColorScaleConfigProps,
    PersistableColorScaleConfigProps
} from "charts/color/ColorScaleConfig"
import { MapConfig } from "charts/mapCharts/MapConfig"
import { observable } from "mobx"
import {
    Persistable,
    objectWithPersistablesToObject,
    updatePersistables
} from "./Persistable"

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
    addCountryMode?: AddCountryMode
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
    showYearLabels?: boolean // Always show year in labels for bar charts
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
    colorScale?: Partial<ColorScaleConfigProps>
    hideLinesOutsideTolerance?: true
    hideConnectedScatterLines?: boolean // Hides lines between points when timeline spans multiple years. Requested by core-econ for certain charts
    scatterPointLabelStrategy?: ScatterPointLabelStrategy
    compareEndPointsOnly?: true
    matchingEntitiesOnly?: true
    excludedEntities?: number[]

    map?: Partial<MapConfig>
    data?: { availableEntities: string[] }
}

// Simply implements the *saveable* properties of Grapher. This class is only concerned with parsing and serializing.
export class PersistableGrapher implements GrapherInterface, Persistable {
    @observable.ref type: ChartTypeName = "LineChart"
    @observable.ref isExplorable: boolean = false
    @observable.ref id?: number = undefined
    @observable.ref version: number = 1
    @observable.ref slug?: string = undefined
    @observable.ref title?: string = undefined
    @observable.ref subtitle: string = ""
    @observable.ref sourceDesc?: string = undefined
    @observable.ref note: string = ""
    @observable.ref hideTitleAnnotation?: true = undefined
    @observable.ref minTime?: TimeBound = undefined
    @observable.ref maxTime?: TimeBound = undefined
    @observable.ref timelineMinTime?: Time = undefined
    @observable.ref timelineMaxTime?: Time = undefined
    @observable.ref addCountryMode: AddCountryMode = "add-country"
    @observable.ref highlightToggle?: HighlightToggleConfig = undefined
    @observable.ref stackMode: StackMode = "absolute"
    @observable.ref hideLegend?: true = undefined
    @observable.ref logo?: LogoOption = undefined
    @observable.ref hideLogo?: boolean = undefined
    @observable.ref hideRelativeToggle?: boolean = true
    @observable.ref entityType: string = "country"
    @observable.ref entityTypePlural: string = "countries"
    @observable.ref hideTimeline?: true = undefined
    @observable.ref zoomToSelection?: true = undefined
    @observable.ref minPopulationFilter?: number = undefined
    @observable.ref showYearLabels?: boolean = undefined // Always show year in labels for bar charts
    @observable.ref hasChartTab: boolean = true
    @observable.ref hasMapTab: boolean = false
    @observable.ref tab: GrapherTabOption = "chart"
    @observable.ref overlay?: GrapherTabOption = undefined
    @observable.ref internalNotes: string = ""
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

    // Todo: make sure these all have toJson/fromJson methods.
    @observable.ref xAxis = new AxisOptions()
    @observable.ref yAxis = new AxisOptions()

    @observable.ref selectedData: EntitySelection[] = []
    @observable.ref dimensions: ChartDimensionSpec[] = []
    @observable colorScale = new PersistableColorScaleConfigProps()
    @observable excludedEntities?: number[] = undefined
    @observable map: Partial<MapConfig> = {}
    data?: { availableEntities: string[] } = undefined
    @observable comparisonLines: ComparisonLineConfig[] = []
    @observable relatedQuestions?: RelatedQuestionsConfig[]

    externalDataUrl?: string
    owidDataset?: OwidVariablesAndEntityKey
    useV2?: boolean = false

    toObject(): GrapherInterface {
        const defaultObj: GrapherInterface = objectWithPersistablesToObject(
            new PersistableGrapher()
        )
        const obj: GrapherInterface = objectWithPersistablesToObject(this)

        // Never save the followingto the DB.
        delete obj.externalDataUrl
        delete obj.owidDataset
        delete obj.useV2

        // Remove the overlay tab state (e.g. download or sources) in order to avoid saving charts
        // in the Grapher Admin with an overlay tab open
        delete obj.overlay

        const defaultKeys = new Set(Object.keys(defaultObj))
        Object.keys(obj).forEach(prop => {
            const key = prop as GrapherProperty
            if (!defaultKeys.has(key)) {
                // Don't persist any runtime info
                delete obj[key]
                return
            }

            const currentValue = JSON.stringify(obj[key])
            const defaultValue = JSON.stringify(defaultObj[key])
            if (currentValue === defaultValue) {
                // Don't persist any values that weren't changed from the default
                delete obj[key]
            }
        })

        // JSON doesn't support Infinity, so we use strings instead.
        if (obj.minTime) obj.minTime = minTimeToJSON(this.minTime) as any
        if (obj.maxTime) obj.maxTime = maxTimeToJSON(this.maxTime) as any

        return obj as GrapherInterface
    }

    updateFromObject(obj: GrapherInterface) {
        if (!obj) return
        updatePersistables(this, obj)

        // JSON doesn't support Infinity, so we use strings instead.
        if (obj.minTime) this.minTime = minTimeToJSON(obj.minTime) as number
        if (obj.maxTime) this.maxTime = maxTimeToJSON(obj.maxTime) as number
    }
}
