import * as _ from "lodash-es"
import {
    GRAPHER_CHART_TYPES,
    StackMode,
    ScaleType,
    FacetStrategy,
    GrapherQueryParams,
    GrapherChartType,
} from "@ourworldindata/types"
import { cartesian, PartialRecord } from "@ourworldindata/utils"

export type ViewMatrix = PartialRecord<keyof GrapherQueryParams, string[]>

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
const focusOptions = ["<none>", "<firstSeries>"]

const VIEW_MATRIX_BY_CHART_TYPE: Record<GrapherChartType, ViewMatrix> = {
    [GRAPHER_CHART_TYPES.LineChart]: {
        tab: ["line", "map", "slope", "discrete-bar", "marimekko"],
        time: timeSpan,
        stackMode: stackModeOptions,
        yScale: scaleTypeOptions,
        facet: facetOptions,
        uniformYAxis: booleanOptions,
        focus: focusOptions,
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
        focus: focusOptions,
        // uniformYAxis doesn't apply
    },
    [GRAPHER_CHART_TYPES.StackedDiscreteBar]: {
        tab: ["chart"],
        time: timePoints,
        stackMode: stackModeOptions,
        facet: facetOptions,
        focus: focusOptions,
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
        focus: focusOptions,
    },
    [GRAPHER_CHART_TYPES.StackedArea]: {
        tab: ["chart"],
        time: timeSpan,
        stackMode: stackModeOptions,
        facet: facetOptions,
        uniformYAxis: booleanOptions,
        focus: focusOptions,
    },
    [GRAPHER_CHART_TYPES.StackedBar]: {
        tab: ["chart"],
        time: timeSpan,
        stackMode: stackModeOptions,
        facet: facetOptions,
        uniformYAxis: booleanOptions,
        focus: focusOptions,
    },
}

// The above view matrix is used to generate all possible combinations of query params
// but some combinations don't make sense. this matrix is used to exclude those combinations.
// for example, if a chart is not faceted, the uniformYAxis param doesn't apply
const EXCLUDE_VIEWS_BY_CHART_TYPE: Record<
    GrapherChartType,
    PartialRecord<keyof GrapherQueryParams, string>[]
> = {
    [GRAPHER_CHART_TYPES.LineChart]: [
        // Line charts only make sense for a time span
        { tab: "line", time: TimePoint.earliest },
        { tab: "line", time: TimePoint.latest },
        // Slope charts only make sense for a time span
        { tab: "slope", time: TimePoint.earliest },
        { tab: "slope", time: TimePoint.latest },
        // Bar charts and marimekko plots only make sense for a time point
        { tab: "discrete-bar", time: TimeSpan.earliestLatest },
        { tab: "marimekko", time: TimeSpan.earliestLatest },
        // Sharing an axis only makes sense if a chart is faceted
        { facet: FacetStrategy.none, uniformYAxis: Boolean.true },
        // Log scale for percentage values doesn't make sense
        { stackMode: StackMode.relative, yScale: ScaleType.log },
        // Exclude all extra options for maps, bar charts and marimekko plots
        { tab: "map", stackMode: StackMode.relative },
        { tab: "map", yScale: ScaleType.log },
        { tab: "map", facet: FacetStrategy.entity },
        { tab: "map", facet: FacetStrategy.metric },
        { tab: "discrete-bar", stackMode: StackMode.relative },
        { tab: "discrete-bar", yScale: ScaleType.log },
        { tab: "discrete-bar", facet: FacetStrategy.entity },
        { tab: "discrete-bar", facet: FacetStrategy.metric },
        { tab: "marimekko", stackMode: StackMode.relative },
        { tab: "marimekko", yScale: ScaleType.log },
        { tab: "marimekko", facet: FacetStrategy.entity },
        { tab: "marimekko", facet: FacetStrategy.metric },
        // Test focus mode only in the default view
        { focus: "<firstSeries>", tab: "map" },
        { focus: "<firstSeries>", tab: "slope" },
        { focus: "<firstSeries>", tab: "discrete-bar" },
        { focus: "<firstSeries>", tab: "marimekko" },
        { focus: "<firstSeries>", stackMode: StackMode.relative },
        { focus: "<firstSeries>", yScale: ScaleType.log },
        { focus: "<firstSeries>", facet: FacetStrategy.entity },
        { focus: "<firstSeries>", facet: FacetStrategy.metric },
        { focus: "<firstSeries>", uniformYAxis: Boolean.true },
    ],
    [GRAPHER_CHART_TYPES.ScatterPlot]: [
        // Relative mode only makes sense if a time span is selected
        { time: TimePoint.earliest, stackMode: StackMode.relative },
        { time: TimePoint.latest, stackMode: StackMode.relative },
        // Selecting the end points only makes sense if a time span is selected
        { time: TimePoint.earliest, endpointsOnly: Boolean.true },
        { time: TimePoint.latest, endpointsOnly: Boolean.true },
        // Selecting the end points only makes sense if relative mode is not selected
        { stackMode: StackMode.relative, endpointsOnly: Boolean.true },
        // Log scale for percentage values doesn't make sense
        { stackMode: StackMode.relative, yScale: ScaleType.log },
        { stackMode: StackMode.relative, xScale: ScaleType.log },
    ],
    [GRAPHER_CHART_TYPES.DiscreteBar]: [
        // Test focus mode only in the default view
        { focus: "<firstSeries>", facet: FacetStrategy.entity },
        { focus: "<firstSeries>", facet: FacetStrategy.metric },
    ],
    [GRAPHER_CHART_TYPES.StackedDiscreteBar]: [
        // Test focus mode only in the default view
        { focus: "<firstSeries>", stackMode: StackMode.relative },
        { focus: "<firstSeries>", facet: FacetStrategy.entity },
        { focus: "<firstSeries>", facet: FacetStrategy.metric },
    ],
    [GRAPHER_CHART_TYPES.Marimekko]: [],
    [GRAPHER_CHART_TYPES.SlopeChart]: [
        // Test focus mode only in the default view
        { focus: "<firstSeries>", yScale: ScaleType.log },
    ],
    [GRAPHER_CHART_TYPES.StackedArea]: [
        // Sharing an axis only makes sense if a chart is faceted
        { facet: FacetStrategy.none, uniformYAxis: Boolean.true },
        // Test focus mode only in the default view
        { focus: "<firstSeries>", stackMode: StackMode.relative },
        { focus: "<firstSeries>", facet: FacetStrategy.entity },
        { focus: "<firstSeries>", facet: FacetStrategy.metric },
        { focus: "<firstSeries>", uniformYAxis: Boolean.true },
    ],
    [GRAPHER_CHART_TYPES.StackedBar]: [
        // Sharing an axis only makes sense if a chart is faceted
        { facet: FacetStrategy.none, uniformYAxis: Boolean.true },
        // Test focus mode only in the default view
        { focus: "<firstSeries>", stackMode: StackMode.relative },
        { focus: "<firstSeries>", facet: FacetStrategy.entity },
        { focus: "<firstSeries>", facet: FacetStrategy.metric },
        { focus: "<firstSeries>", uniformYAxis: Boolean.true },
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
