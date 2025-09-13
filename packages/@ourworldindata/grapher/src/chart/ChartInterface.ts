import { OwidTable } from "@ourworldindata/core-table"
import {
    FacetStrategy,
    SeriesName,
    SeriesStrategy,
    Color,
    ChartErrorInfo,
} from "@ourworldindata/types"
import { ColorScale } from "../color/ColorScale"
import { HorizontalAxis, VerticalAxis } from "../axis/Axis"
import { HorizontalColorLegendManager } from "../horizontalColorLegend/HorizontalColorLegends"
import { SelectionArray } from "../selection/SelectionArray"
import { FocusArray } from "../focus/FocusArray"

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
    /** Fail message(s) to show to the user if something went wrong */
    errorInfo: ChartErrorInfo

    /** OwidTable coming into the chart */
    inputTable: OwidTable
    /** OwidTable after the chart has transformed the input table */
    transformedTable: OwidTable

    /** Array of selected entities for the chart */
    selectionArray?: SelectionArray
    /** Array of series that should be highlighted or focused */
    focusArray?: FocusArray

    /** Marks that the chart will render. Not placed yet */
    series: readonly ChartSeries[]
    /** Strategy for handling multiple data series in the chart */
    seriesStrategy?: SeriesStrategy

    /** Function to transform the input table into the format needed by the chart */
    transformTable: ChartTableTransformer
    /** Optional function to transform the table specifically for the rendered data table */
    transformTableForDisplay?: ChartTableTransformer
    /** Optional function to transform the table specifically for the entity selector */
    transformTableForSelection?: ChartTableTransformer

    /** Color scale used to assign colors to chart elements */
    colorScale?: ColorScale

    /**
     * Available facet strategies that are supported by this chart type in its
     * current configuration, if any. Does not necessarily contain
     * FacetStrategy.None - there are situations where an unfaceted chart
     * doesn't make sense.
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
