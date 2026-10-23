/**
 * Builders for the configs that tests seed. They only set what makes a chart
 * of that type render with the fixture indicators; tests spread in the
 * settings their scenario depends on, so those stay visible at the call site.
 */
import {
    DimensionProperty,
    GRAPHER_CHART_TYPES,
    type GrapherChartType,
    type GrapherInterface,
    type OwidChartDimensionInterface,
} from "@ourworldindata/types"
import { entities, type FixtureIndicator } from "./fixture.js"

const dimension = (
    property: DimensionProperty,
    indicator: FixtureIndicator
): OwidChartDimensionInterface => ({ property, variableId: indicator.id })

const yDimensions = (
    indicators: FixtureIndicator[]
): OwidChartDimensionInterface[] =>
    indicators.map((indicator) => dimension(DimensionProperty.y, indicator))

export const defaultSelection = [entities.france.name, entities.kenya.name]

// A fixed title keeps the editor from filling in the automatic one on save
const title = "Test chart"

function chartOfType(
    chartType: GrapherChartType,
    indicators: FixtureIndicator[]
): GrapherInterface {
    return {
        title,
        chartTypes: [chartType],
        dimensions: yDimensions(indicators),
        selectedEntityNames: defaultSelection,
    }
}

export const lineChart = (...y: FixtureIndicator[]): GrapherInterface =>
    chartOfType(GRAPHER_CHART_TYPES.LineChart, y)

export const slopeChart = (...y: FixtureIndicator[]): GrapherInterface =>
    chartOfType(GRAPHER_CHART_TYPES.SlopeChart, y)

export const discreteBarChart = (...y: FixtureIndicator[]): GrapherInterface =>
    chartOfType(GRAPHER_CHART_TYPES.DiscreteBar, y)

export const stackedAreaChart = (...y: FixtureIndicator[]): GrapherInterface =>
    chartOfType(GRAPHER_CHART_TYPES.StackedArea, y)

export const stackedBarChart = (...y: FixtureIndicator[]): GrapherInterface =>
    chartOfType(GRAPHER_CHART_TYPES.StackedBar, y)

export const stackedDiscreteBarChart = (
    ...y: FixtureIndicator[]
): GrapherInterface => chartOfType(GRAPHER_CHART_TYPES.StackedDiscreteBar, y)

export const dumbbellChart = (...y: FixtureIndicator[]): GrapherInterface =>
    chartOfType(GRAPHER_CHART_TYPES.Dumbbell, y)

export const mapChart = (y: FixtureIndicator): GrapherInterface => ({
    title,
    chartTypes: [],
    hasMapTab: true,
    tab: "map",
    dimensions: yDimensions([y]),
})

export function scatterPlot({
    x,
    y,
    size,
    color,
}: {
    x: FixtureIndicator
    y: FixtureIndicator
    size?: FixtureIndicator
    color?: FixtureIndicator
}): GrapherInterface {
    return {
        title,
        chartTypes: [GRAPHER_CHART_TYPES.ScatterPlot],
        dimensions: [
            dimension(DimensionProperty.y, y),
            dimension(DimensionProperty.x, x),
            ...(size ? [dimension(DimensionProperty.size, size)] : []),
            ...(color ? [dimension(DimensionProperty.color, color)] : []),
        ],
    }
}

export function marimekkoChart({
    x,
    y,
}: {
    x: FixtureIndicator
    y: FixtureIndicator
}): GrapherInterface {
    return {
        title,
        chartTypes: [GRAPHER_CHART_TYPES.Marimekko],
        dimensions: [
            dimension(DimensionProperty.y, y),
            dimension(DimensionProperty.x, x),
        ],
    }
}
