import _ from "lodash"
import {
    ChartTypeName,
    StackMode,
    ScaleType,
    FacetStrategy,
    GrapherQueryParams,
} from "@ourworldindata/grapher"
import { cartesian } from "@ourworldindata/utils"

export type ViewMatrix = Record<keyof GrapherQueryParams, string[]>

enum TimePoint {
    earliest = "earliest",
    latest = "latest",
}

enum TimeSpan {
    earliestLatest = "earliest..latest",
}

enum Boolean {
    true = "1",
    false = "0",
}

const timePoints = Object.values(TimePoint)
const timeSpan = Object.values(TimeSpan)
const timeOptionsAll = [...timePoints, ...timeSpan]
const stackModeOptions = Object.values(StackMode)
const scaleTypeOptions = Object.values(ScaleType)
const facetOptions = Object.values(FacetStrategy)
const booleanOptions = Object.values(Boolean)

const VIEW_MATRIX_BY_CHART_TYPE: Record<ChartTypeName, ViewMatrix> = {
    [ChartTypeName.LineChart]: {
        tab: ["chart"],
        time: timeOptionsAll,
        stackMode: stackModeOptions,
        yScale: scaleTypeOptions,
        facet: facetOptions,
        uniformYAxis: booleanOptions,
    },
    [ChartTypeName.ScatterPlot]: {
        tab: ["chart"],
        time: timeOptionsAll,
        stackMode: stackModeOptions,
        xScale: scaleTypeOptions,
        yScale: scaleTypeOptions,
        endpointsOnly: booleanOptions,
        // zoomToSelection ignored for now
    },
    [ChartTypeName.DiscreteBar]: {
        tab: ["chart"],
        time: timePoints,
        facet: facetOptions,
        // uniformYAxis doesn't apply
    },
    [ChartTypeName.StackedDiscreteBar]: {
        tab: ["chart"],
        time: timePoints,
        stackMode: stackModeOptions,
        facet: facetOptions,
        // uniformYAxis doesn't apply
    },
    [ChartTypeName.Marimekko]: {
        tab: ["chart"],
        time: timePoints,
        stackMode: stackModeOptions,
        showNoDataArea: booleanOptions,
    },
    [ChartTypeName.SlopeChart]: {
        tab: ["chart"],
        time: timeSpan,
    },
    [ChartTypeName.StackedArea]: {
        tab: ["chart"],
        time: timeSpan,
        stackMode: stackModeOptions,
        facet: facetOptions,
        uniformYAxis: booleanOptions,
    },
    [ChartTypeName.StackedBar]: {
        tab: ["chart"],
        time: timeSpan,
        stackMode: stackModeOptions,
        facet: facetOptions,
        uniformYAxis: booleanOptions,
    },
    [ChartTypeName.WorldMap]: {},
}

// the above view matrix is used to generate all possible combinations of query params
// but some combinations don't make sense. this matrix is used to exclude those combinations.
// for example, if a chart is not faceted, the uniformYAxis param doesn't apply
const EXCLUDE_VIEWS_BY_CHART_TYPE: Record<
    ChartTypeName,
    Record<keyof GrapherQueryParams, string>[]
> = {
    [ChartTypeName.LineChart]: [
        // sharing an axis only makes sense if a chart is faceted
        { facet: FacetStrategy.none, uniformYAxis: Boolean.true },
        // log scale for percentage values doesn't make sense
        { stackMode: StackMode.relative, yScale: ScaleType.log },
    ],
    [ChartTypeName.ScatterPlot]: [
        // relative mode only makes sense if a time span is selected
        { time: TimePoint.earliest, stackMode: StackMode.relative },
        { time: TimePoint.latest, stackMode: StackMode.relative },
        // selecting the end points only makes sense if a time span is selected
        { time: TimePoint.earliest, endpointsOnly: Boolean.true },
        { time: TimePoint.latest, endpointsOnly: Boolean.true },
        // selecting the end points only makes sense if relative mode is not selected
        { stackMode: StackMode.relative, endpointsOnly: Boolean.true },
        // log scale for percentage values doesn't make sense
        { stackMode: StackMode.relative, yScale: ScaleType.log },
        { stackMode: StackMode.relative, xScale: ScaleType.log },
    ],
    [ChartTypeName.DiscreteBar]: [],
    [ChartTypeName.StackedDiscreteBar]: [],
    [ChartTypeName.Marimekko]: [],
    [ChartTypeName.SlopeChart]: [],
    [ChartTypeName.StackedArea]: [
        // sharing an axis only makes sense if a chart is faceted
        { facet: FacetStrategy.none, uniformYAxis: Boolean.true },
    ],
    [ChartTypeName.StackedBar]: [
        // sharing an axis only makes sense if a chart is faceted
        { facet: FacetStrategy.none, uniformYAxis: Boolean.true },
    ],
    [ChartTypeName.WorldMap]: [],
}

export const queryStringsByChartType = Object.fromEntries(
    Object.entries(VIEW_MATRIX_BY_CHART_TYPE).map(([chartType, viewMatrix]) => {
        const combinations = explode(viewMatrix)

        const viewsToExclude =
            EXCLUDE_VIEWS_BY_CHART_TYPE[chartType as ChartTypeName]
        const validCombinations = combinations.filter((view) =>
            viewsToExclude.every(
                (viewToExclude) => !_.isMatch(view, viewToExclude)
            )
        )

        const queryStrings = validCombinations.map(toQueryStr)
        return [chartType, queryStrings]
    })
) as Record<ChartTypeName, string[]>

function toQueryStr(params: Record<string, string>): string {
    return new URLSearchParams(params).toString()
}

function explode(viewMatrix: ViewMatrix): Record<string, string>[] {
    const paramKeys = Object.keys(viewMatrix)
    const paramValues = Object.values(viewMatrix)
    const combinations = cartesian(paramValues)
    const keyedCombinations = combinations.map((c: string[]) =>
        _.zipObject(paramKeys, c)
    )
    return keyedCombinations
}
