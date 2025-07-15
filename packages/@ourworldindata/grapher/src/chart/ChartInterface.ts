import { OwidTable } from "@ourworldindata/core-table"
import {
    FacetStrategy,
    SeriesName,
    SeriesStrategy,
    Color,
} from "@ourworldindata/types"
import { ColorScale } from "../color/ColorScale"
import { HorizontalAxis, VerticalAxis } from "../axis/Axis"
import { HorizontalColorLegendManager } from "../horizontalColorLegend/HorizontalColorLegends"

// The idea of this interface is to try and start reusing more code across our Chart classes and make it easier
// for a dev to work on a chart type they haven't touched before if they've worked with another that implements
// this interface.

export interface ChartSeries {
    seriesName: SeriesName
    color: Color
}

export type ChartTableTransformer = (inputTable: OwidTable) => OwidTable

/** Interface implemented by all chart state classes */
export interface ChartState {
    failMessage: string // We require every chart have some fail message(s) to show to the user if something went wrong

    inputTable: OwidTable // Points to the OwidTable coming into the chart. All charts have an inputTable. Standardized as part of the interface as a development aid.
    transformedTable: OwidTable // Points to the OwidTable after the chart has transformed the input table. The chart may add a relative transform, for example. Standardized as part of the interface as a development aid.

    series: readonly ChartSeries[] // This points to the marks that the chart will render. They don't have to be placed yet. Standardized as part of the interface as a development aid.
    seriesStrategy?: SeriesStrategy

    transformTable: ChartTableTransformer
    transformTableForDisplay?: ChartTableTransformer
    transformTableForSelection?: ChartTableTransformer

    colorScale?: ColorScale

    /**
     * Which facet strategies the chart type finds reasonable in its current setting, if any.
     * Does not necessarily contain FacetStrategy.None -- there are situations where an unfaceted chart doesn't make sense.
     */
    availableFacetStrategies?: FacetStrategy[]
}

/** Interface implemented by all chart component classes */
export interface ChartInterface {
    chartState: ChartState

    yAxis?: HorizontalAxis | VerticalAxis
    xAxis?: HorizontalAxis | VerticalAxis

    /**
     * The legend that has been hidden from the chart plot (using `manager.hideLegend`).
     * Used to create a global legend for faceted charts.
     */
    externalLegend?: HorizontalColorLegendManager

    /**
     * Opt-out of assigned colors and use a value-based color scheme instead.
     * Only relevant for StackedBar charts.
     */
    shouldUseValueBasedColorScheme?: boolean
}
