import { observable } from "mobx"
import {
    ChartTypeName,
    StackMode,
    ChartTabOption,
    ScatterPointLabelStrategy,
    HighlightToggleConfig,
    Color,
    RelatedQuestionsConfig
} from "./ChartConstants"
import { AxisOptionsInterface } from "charts/axis/Axis"
import { OwidVariablesAndEntityKey } from "owidTable/OwidVariable"
import { TimeBound, Time } from "charts/utils/TimeBounds"
import { ChartDimensionSpec } from "./ChartDimension"
import { ComparisonLineConfig } from "charts/scatterCharts/ComparisonLine"
import { LogoOption } from "./Logos"
import { ColorScaleConfigProps } from "charts/color/ColorScaleConfig"
import { MapConfig } from "charts/mapCharts/MapConfig"

interface EntitySelection {
    entityId: number
    index: number // Which dimension the entity is from
    color?: Color
}

// This configuration represents the entire persistent state of a grapher chart
// Ideally, this is also all of the interaction state: when a chart is saved and loaded again
// under the same rendering conditions it ought to remain visually identical
export class ChartScript {
    constructor(initial?: Partial<ChartScript>) {
        if (initial) {
            for (const key in this) {
                if (key in initial) {
                    ;(this as any)[key] = (initial as any)[key]
                }
            }
        }
    }

    @observable.ref type: ChartTypeName = "LineChart"
    @observable.ref isExplorable: boolean = false

    @observable.ref id?: number = undefined
    @observable.ref version: number = 1

    @observable.ref slug?: string = undefined
    @observable.ref title?: string = undefined
    @observable.ref subtitle?: string = undefined
    @observable.ref sourceDesc?: string = undefined
    @observable.ref note?: string = undefined
    @observable.ref hideTitleAnnotation?: true = undefined

    @observable.ref xAxis: Partial<AxisOptionsInterface> = {}
    @observable.ref yAxis: Partial<AxisOptionsInterface> = {}

    // TODO: These 2 are currently in development. Do not save to DB.
    @observable.ref externalDataUrl?: string = undefined
    @observable.ref owidDataset?: OwidVariablesAndEntityKey = undefined

    // Todo: remove once we migrate to all tables
    useV2?: boolean = false

    @observable.ref selectedData: EntitySelection[] = []
    @observable.ref minTime?: TimeBound = undefined
    @observable.ref maxTime?: TimeBound = undefined

    @observable.ref timelineMinTime?: Time = undefined
    @observable.ref timelineMaxTime?: Time = undefined

    @observable.ref dimensions: ChartDimensionSpec[] = []
    @observable.ref addCountryMode?:
        | "add-country"
        | "change-country"
        | "disabled" = undefined

    @observable comparisonLines?: ComparisonLineConfig[] = undefined
    @observable.ref highlightToggle?: HighlightToggleConfig = undefined
    @observable.ref stackMode: StackMode = "absolute"
    @observable.ref hideLegend?: true = undefined
    @observable.ref logo?: LogoOption = undefined
    @observable.ref hideLogo?: boolean = undefined
    @observable.ref hideRelativeToggle?: boolean = true
    @observable.ref entityType?: string = undefined
    @observable.ref entityTypePlural?: string = undefined
    @observable.ref hideTimeline?: true = undefined
    @observable.ref zoomToSelection?: true = undefined
    @observable.ref minPopulationFilter?: number = undefined

    // Always show year in labels for bar charts
    @observable.ref showYearLabels?: boolean = undefined

    @observable.ref hasChartTab: boolean = true
    @observable.ref hasMapTab: boolean = false
    @observable.ref tab: ChartTabOption = "chart"
    @observable.ref overlay?: ChartTabOption = undefined

    @observable relatedQuestions?: RelatedQuestionsConfig[]
    @observable.ref internalNotes?: string = undefined
    @observable.ref variantName?: string = undefined
    @observable.ref originUrl?: string = undefined
    @observable.ref isPublished?: true = undefined

    @observable.ref baseColorScheme?: string = undefined
    @observable.ref invertColorScheme?: true = undefined

    // SCATTERPLOT-SPECIFIC OPTIONS

    @observable colorScale: Partial<ColorScaleConfigProps> = {}

    @observable.ref hideLinesOutsideTolerance?: true = undefined

    // Hides lines between points when timeline spans multiple years. Requested by core-econ for certain charts
    @observable hideConnectedScatterLines?: boolean = undefined
    @observable
    scatterPointLabelStrategy?: ScatterPointLabelStrategy = undefined
    @observable.ref compareEndPointsOnly?: true = undefined
    @observable.ref matchingEntitiesOnly?: true = undefined
    @observable excludedEntities?: number[] = undefined

    @observable map: Partial<MapConfig> = {}

    data?: { availableEntities: string[] } = undefined
}
