import _ from "lodash"
import {
    GRAPHER_CHART_TYPES,
    StackMode,
    ScaleType,
    FacetStrategy,
    GrapherQueryParams,
    GrapherChartType,
} from "@ourworldindata/types"
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

const VIEW_MATRIX_BY_CHART_TYPE: Record<GrapherChartType, ViewMatrix> = {
    [GRAPHER_CHART_TYPES.LineChart]: {
        tab: ["chart"],
        time: timeOptionsAll,
        stackMode: stackModeOptions,
        yScale: scaleTypeOptions,
        facet: facetOptions,
        uniformYAxis: booleanOptions,
    },
    [GRAPHER_CHART_TYPES.ScatterPlot]: {
        tab: ["chart"],
        time: timeOptionsAll,
        stackMode: stackModeOptions,
        xScale: scaleTypeOptions,
        yScale: scaleTypeOptions,
        endpointsOnly: booleanOptions,
        // zoomToSelection ignored for now
    },
    [GRAPHER_CHART_TYPES.DiscreteBar]: {
        tab: ["chart"],
        time: timePoints,
        facet: facetOptions,
        // uniformYAxis doesn't apply
    },
    [GRAPHER_CHART_TYPES.StackedDiscreteBar]: {
        tab: ["chart"],
        time: timePoints,
        stackMode: stackModeOptions,
        facet: facetOptions,
        // uniformYAxis doesn't apply
    },
    [GRAPHER_CHART_TYPES.Marimekko]: {
        tab: ["chart"],
        time: timePoints,
        stackMode: stackModeOptions,
        showNoDataArea: booleanOptions,
    },
    [GRAPHER_CHART_TYPES.SlopeChart]: {
        tab: ["chart"],
        time: timeSpan,
        yScale: scaleTypeOptions,
    },
    [GRAPHER_CHART_TYPES.StackedArea]: {
        tab: ["chart"],
        time: timeSpan,
        stackMode: stackModeOptions,
        facet: facetOptions,
        uniformYAxis: booleanOptions,
    },
    [GRAPHER_CHART_TYPES.StackedBar]: {
        tab: ["chart"],
        time: timeSpan,
        stackMode: stackModeOptions,
        facet: facetOptions,
        uniformYAxis: booleanOptions,
    },
}

// the above view matrix is used to generate all possible combinations of query params
// but some combinations don't make sense. this matrix is used to exclude those combinations.
// for example, if a chart is not faceted, the uniformYAxis param doesn't apply
const EXCLUDE_VIEWS_BY_CHART_TYPE: Record<
    GrapherChartType,
    Record<keyof GrapherQueryParams, string>[]
> = {
    [GRAPHER_CHART_TYPES.LineChart]: [
        // sharing an axis only makes sense if a chart is faceted
        { facet: FacetStrategy.none, uniformYAxis: Boolean.true },
        // log scale for percentage values doesn't make sense
        { stackMode: StackMode.relative, yScale: ScaleType.log },
    ],
    [GRAPHER_CHART_TYPES.ScatterPlot]: [
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
    [GRAPHER_CHART_TYPES.DiscreteBar]: [],
    [GRAPHER_CHART_TYPES.StackedDiscreteBar]: [],
    [GRAPHER_CHART_TYPES.Marimekko]: [],
    [GRAPHER_CHART_TYPES.SlopeChart]: [],
    [GRAPHER_CHART_TYPES.StackedArea]: [
        // sharing an axis only makes sense if a chart is faceted
        { facet: FacetStrategy.none, uniformYAxis: Boolean.true },
    ],
    [GRAPHER_CHART_TYPES.StackedBar]: [
        // sharing an axis only makes sense if a chart is faceted
        { facet: FacetStrategy.none, uniformYAxis: Boolean.true },
    ],
}

export const queryStringsByChartType = Object.fromEntries(
    Object.entries(VIEW_MATRIX_BY_CHART_TYPE).map(([chartType, viewMatrix]) => {
        const combinations = explode(viewMatrix)

        const viewsToExclude =
            EXCLUDE_VIEWS_BY_CHART_TYPE[chartType as GrapherChartType]
        const validCombinations = combinations.filter((view) =>
            viewsToExclude.every(
                (viewToExclude) => !_.isMatch(view, viewToExclude)
            )
        )

        const queryStrings = validCombinations.map(toQueryStr)
        return [chartType, queryStrings]
    })
) as Record<GrapherChartType, string[]>

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
