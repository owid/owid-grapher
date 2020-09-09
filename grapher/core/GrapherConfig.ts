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
    AxisConfigInterface,
    PersistableAxisConfig,
} from "grapher/axis/AxisConfig"
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
    PersistableChartDimension,
    ChartDimensionConfig,
} from "grapher/chart/ChartDimension"
import { ComparisonLineConfig } from "grapher/scatterCharts/ComparisonLine"
import { LogoOption } from "grapher/chart/Logos"
import {
    ColorScaleConfigInterface,
    PersistableColorScaleConfig,
} from "grapher/color/ColorScaleConfig"
import {
    MapConfigInterface,
    PersistableMapConfig,
} from "grapher/mapCharts/MapConfig"
import { observable, action } from "mobx"
import {
    Persistable,
    objectWithPersistablesToObject,
    updatePersistables,
    deleteRuntimeAndUnchangedProps,
} from "grapher/persistable/Persistable"

interface EntitySelection {
    entityId: number
    index: number // Which dimension the entity is from
    color?: Color
}

// This configuration represents the entire persistent state of a grapher
// Ideally, this is also all of the interaction state: when a grapher is saved and loaded again
// under the same rendering conditions it ought to remain visually identical
export interface GrapherConfigInterface {
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
    externalDataUrl?: string
    owidDataset?: OwidVariablesAndEntityKey
    manuallyProvideData?: boolean
    selectedData?: EntitySelection[]
    minTime?: TimeBound
    maxTime?: TimeBound
    timelineMinTime?: Time
    timelineMaxTime?: Time
    dimensions?: ChartDimensionConfig[]
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
    hideLinesOutsideTolerance?: true
    hideConnectedScatterLines?: boolean // Hides lines between points when timeline spans multiple years. Requested by core-econ for certain charts
    scatterPointLabelStrategy?: ScatterPointLabelStrategy
    compareEndPointsOnly?: true
    matchingEntitiesOnly?: true
    excludedEntities?: number[]

    xAxis?: Partial<AxisConfigInterface>
    yAxis?: Partial<AxisConfigInterface>
    colorScale?: Partial<ColorScaleConfigInterface>
    map?: Partial<MapConfigInterface>
}

// Simply implements the *saveable* properties of Grapher. This class is only concerned with parsing and serializing.
export class PersistableGrapher implements GrapherConfigInterface, Persistable {
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
    @observable.ref xAxis = new PersistableAxisConfig() // todo: rename class to be persistable
    @observable.ref yAxis = new PersistableAxisConfig()
    @observable colorScale = new PersistableColorScaleConfig()
    @observable map = new PersistableMapConfig()

    @observable.ref selectedData: EntitySelection[] = []
    @observable.ref dimensions: PersistableChartDimension[] = []
    @observable excludedEntities?: number[] = undefined
    @observable comparisonLines: ComparisonLineConfig[] = []
    @observable relatedQuestions?: RelatedQuestionsConfig[]

    externalDataUrl?: string = undefined // This is temporarily used for testing legacy prod charts locally. Will be removed
    owidDataset?: OwidVariablesAndEntityKey = undefined // This is temporarily used for testing. Will be removed
    manuallyProvideData?: boolean = false // This will be removed.

    constructor(props?: GrapherConfigInterface) {
        if (props) this.updateFromObject(props)
    }

    // Should return the default initialized object. This is what `toObject` will compare against to generate the persistable state.
    defaultObject() {
        return objectWithPersistablesToObject(new PersistableGrapher())
    }

    toObject() {
        const obj: GrapherConfigInterface = objectWithPersistablesToObject(this)

        // Never save the followingto the DB.
        delete obj.externalDataUrl
        delete obj.owidDataset
        delete obj.manuallyProvideData

        // Remove the overlay tab state (e.g. download or sources) in order to avoid saving charts
        // in the Grapher Admin with an overlay tab open
        delete obj.overlay

        deleteRuntimeAndUnchangedProps<GrapherConfigInterface>(
            obj,
            this.defaultObject()
        )

        // JSON doesn't support Infinity, so we use strings instead.
        if (obj.minTime) obj.minTime = minTimeToJSON(this.minTime) as any
        if (obj.maxTime) obj.maxTime = maxTimeToJSON(this.maxTime) as any

        return obj
    }

    @action.bound updateFromObject(obj: GrapherConfigInterface) {
        if (!obj) return
        updatePersistables(this, obj)

        // Regression fix: some legacies have this set to Null. Todo: clean DB.
        if (obj.originUrl === null) this.originUrl = ""

        if (obj.dimensions?.length)
            this.dimensions = obj.dimensions.map(
                (spec: ChartDimensionConfig) =>
                    new PersistableChartDimension(spec)
            )

        // JSON doesn't support Infinity, so we use strings instead.
        if (obj.minTime) this.minTime = minTimeFromJSON(obj.minTime)
        if (obj.maxTime) this.maxTime = maxTimeFromJSON(obj.maxTime)
    }
}
