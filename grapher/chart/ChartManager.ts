import { AxisConfig } from "grapher/axis/AxisConfig"
import { ColorScaleConfigInterface } from "grapher/color/ColorScaleConfig"
import {
    EntitySelectionMode,
    FacetStrategy,
    SeriesStrategy,
} from "grapher/core/GrapherConstants"
import { ComparisonLineConfig } from "grapher/scatterCharts/ComparisonLine"
import { TooltipProps } from "grapher/tooltip/TooltipProps"
import { OwidTable } from "coreTable/OwidTable"
import { ColumnSlug } from "coreTable/CoreTableConstants"
import { AxisConfigInterface } from "grapher/axis/AxisConfigInterface"

// NB: Traditionally you would simply have an "Options" class. However, in order to enable our "Reactivity" with Mobx, we term
// our Options as a "Manager". To get or set any of the options, you then have to "dot in" to the manager
// instance. By "dotting in" Mobx will track the reads or trigger actions on writes. You can still also just create plain
// vanilla JS options objects to easily make static charts (without reactivity).
export interface ChartManager {
    baseFontSize?: number
    table: OwidTable // todo: abstract table?
    isSelectingData?: boolean
    startSelectingWhenLineClicked?: boolean // used by lineLabels
    isStaticSvg?: boolean
    isRelativeMode?: boolean
    comparisonLines?: ComparisonLineConfig[]
    hideLegend?: boolean
    tooltip?: TooltipProps
    useTimelineDomains?: boolean
    baseColorScheme?: string
    invertColorScheme?: boolean
    compareEndPointsOnly?: boolean
    zoomToSelection?: boolean
    matchingEntitiesOnly?: boolean

    colorScale?: ColorScaleConfigInterface

    yAxis?: AxisConfig // Remove? Just pass interfaces?
    xAxis?: AxisConfig
    yAxisConfig?: AxisConfigInterface
    xAxisConfig?: AxisConfigInterface

    addCountryMode?: EntitySelectionMode

    yColumnSlug?: ColumnSlug
    yColumnSlugs?: ColumnSlug[]
    xColumnSlug?: ColumnSlug
    sizeColumnSlug?: ColumnSlug
    colorColumnSlug?: ColumnSlug

    hidePoints?: boolean // for line options
    lineStrokeWidth?: number

    hideXAxis?: boolean
    hideYAxis?: boolean

    facetStrategy?: FacetStrategy // todo: make a strategy? a column prop? etc

    seriesStrategy?: SeriesStrategy
}
