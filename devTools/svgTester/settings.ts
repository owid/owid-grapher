import _ from "lodash"
import {
    ChartTypeName,
    StackMode,
    ScaleType,
    FacetStrategy,
    GrapherQueryParams,
} from "@ourworldindata/grapher"

export type ViewMatrix = Record<keyof GrapherQueryParams, string[]>

const timeOptionsSingle = ["earliest", "latest"]
const timeOptionsDouble = ["earliest..latest"]
const timeOptionsAll = [...timeOptionsSingle, ...timeOptionsDouble]
const stackModeOptions = Object.values(StackMode)
const scaleTypeOptions = Object.values(ScaleType)
const facetOptions = Object.values(FacetStrategy)
const booleanOptions = ["0", "1"]

const VIEW_MATRIX_BY_CHART_TYPE: Record<ChartTypeName, ViewMatrix> = {
    [ChartTypeName.LineChart]: {
        tab: ["chart"],
        time: timeOptionsAll,
        facet: facetOptions,
        yScale: scaleTypeOptions,
        uniformYAxis: booleanOptions,
    },
    [ChartTypeName.ScatterPlot]: {
        tab: ["chart"],
        time: timeOptionsAll,
        xScale: scaleTypeOptions,
        yScale: scaleTypeOptions,
        stackMode: stackModeOptions,
    },
    [ChartTypeName.DiscreteBar]: {
        tab: ["chart"],
        time: timeOptionsSingle,
        facet: facetOptions,
    },
    [ChartTypeName.StackedDiscreteBar]: {
        tab: ["chart"],
        time: timeOptionsSingle,
        facet: facetOptions,
        stackMode: stackModeOptions,
    },
    [ChartTypeName.Marimekko]: {
        tab: ["chart"],
        time: timeOptionsSingle,
        stackMode: stackModeOptions,
        showNoDataArea: booleanOptions,
    },
    [ChartTypeName.SlopeChart]: {
        tab: ["chart"],
        time: timeOptionsDouble,
    },
    [ChartTypeName.StackedArea]: {
        tab: ["chart"],
        time: timeOptionsAll,
        facet: facetOptions,
        uniformYAxis: booleanOptions,
        stackMode: stackModeOptions,
    },
    [ChartTypeName.StackedBar]: {
        tab: ["chart"],
        time: timeOptionsAll,
        facet: facetOptions,
        uniformYAxis: booleanOptions,
        stackMode: stackModeOptions,
    },
    [ChartTypeName.WorldMap]: {},
}

export const queryStringsByChartType = Object.fromEntries(
    Object.entries(VIEW_MATRIX_BY_CHART_TYPE).map(([chartType, viewMatrix]) => {
        const combinations = explode(viewMatrix)
        const queryStrings = combinations.map(toQueryStr)
        return [chartType, queryStrings]
    })
) as Record<ChartTypeName, string[]>

// adapted from from https://stackoverflow.com/questions/12303989/cartesian-product-of-multiple-arrays-in-javascript
function cartesian(matrix: any[][]) {
    if (matrix.length === 0) return []
    if (matrix.length === 1) return matrix[0].map((i) => [i])
    return matrix.reduce((acc, curr) =>
        acc.flatMap((i: any) => curr.map((j: any) => [i, j].flat()))
    )
}

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
