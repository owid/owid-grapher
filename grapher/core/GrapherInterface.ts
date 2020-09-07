import {
    ChartTypeName,
    StackMode,
    GrapherTabOption,
    ScatterPointLabelStrategy,
    HighlightToggleConfig,
    Color,
    RelatedQuestionsConfig,
    AddCountryMode,
} from "./GrapherConstants"
import {
    AxisOptionsInterface,
    PersistableAxisOptions,
} from "grapher/axis/AxisOptions"
import { OwidVariablesAndEntityKey } from "owidTable/OwidVariable"
import {
    TimeBound,
    Time,
    minTimeToJSON,
    maxTimeToJSON,
    minTimeFromJSON,
    maxTimeFromJSON,
} from "grapher/utils/TimeBounds"
import {
    ChartDimensionSpec,
    ChartDimensionInterface,
} from "grapher/chart/ChartDimension"
import { ComparisonLineConfig } from "grapher/scatterCharts/ComparisonLine"
import { LogoOption } from "grapher/chart/Logos"
import {
    ColorScaleConfig,
    PersistableColorScaleConfig,
} from "grapher/color/ColorScaleConfig"
import { MapConfig, PersistableMapConfig } from "grapher/mapCharts/MapConfig"
import { observable, action } from "mobx"
import {
    Persistable,
    objectWithPersistablesToObject,
    updatePersistables,
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
    colorScale?: Partial<ColorScaleConfig>
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
    @observable.ref xAxis = new PersistableAxisOptions() // todo: rename class to be persistable
    @observable.ref yAxis = new PersistableAxisOptions()
    @observable colorScale = new PersistableColorScaleConfig()
    @observable map = new PersistableMapConfig()

    @observable.ref selectedData: EntitySelection[] = []
    @observable.ref dimensions: ChartDimensionSpec[] = []
    @observable excludedEntities?: number[] = undefined
    @observable comparisonLines: ComparisonLineConfig[] = []
    @observable relatedQuestions?: RelatedQuestionsConfig[]
    data?: { availableEntities: string[] } = undefined // Todo: remove

    externalDataUrl?: string = undefined // This is temporarily used for testing legacy prod charts locally. Will be removed
    owidDataset?: OwidVariablesAndEntityKey = undefined // This is temporarily used for testing. Will be removed
    useV2?: boolean = false // This will be removed.

    toObject(): GrapherInterface {
        const obj: GrapherInterface = objectWithPersistablesToObject(this)

        // Never save the followingto the DB.
        delete obj.externalDataUrl
        delete obj.owidDataset
        delete obj.useV2

        // Remove the overlay tab state (e.g. download or sources) in order to avoid saving charts
        // in the Grapher Admin with an overlay tab open
        delete obj.overlay

        this._trimDefaults(obj)

        // JSON doesn't support Infinity, so we use strings instead.
        if (obj.minTime) obj.minTime = minTimeToJSON(this.minTime) as any
        if (obj.maxTime) obj.maxTime = maxTimeToJSON(this.maxTime) as any

        return obj as GrapherInterface
    }

    // Don't persist properties that haven't changed from the defaults
    private _trimDefaults(obj: GrapherInterface) {
        const defaultObj: GrapherInterface = objectWithPersistablesToObject(
            new PersistableGrapher()
        )
        const defaultKeys = new Set(Object.keys(defaultObj))
        Object.keys(obj).forEach((prop) => {
            const key = prop as GrapherProperty
            if (!defaultKeys.has(key)) {
                // Don't persist any runtime props not in the persistable instance
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
    }

    @action.bound updateFromObject(obj: GrapherInterface) {
        if (!obj) return
        updatePersistables(this, obj)

        if (obj.dimensions?.length)
            this.dimensions = obj.dimensions.map(
                (spec: ChartDimensionInterface) => new ChartDimensionSpec(spec)
            )

        // JSON doesn't support Infinity, so we use strings instead.
        if (obj.minTime) this.minTime = minTimeFromJSON(obj.minTime)
        if (obj.maxTime) this.maxTime = maxTimeFromJSON(obj.maxTime)
    }
}
