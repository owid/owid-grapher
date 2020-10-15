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

// The possible options common across our chart types. Not all of these apply to every chart type, so there is room to create a better type hierarchy.

export interface ChartManager {
    baseFontSize?: number
    table: OwidTable // todo: abstract table?
    transformedTable?: OwidTable
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
