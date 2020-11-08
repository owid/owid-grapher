import { AxisConfig } from "grapher/axis/AxisConfig"
import { ColorScaleConfigInterface } from "grapher/color/ColorScaleConfig"
import {
    EntitySelectionMode,
    FacetStrategy,
    SeriesColorMap,
    SeriesStrategy,
} from "grapher/core/GrapherConstants"
import { ComparisonLineConfig } from "grapher/scatterCharts/ComparisonLine"
import { TooltipProps } from "grapher/tooltip/TooltipProps"
import { OwidTable } from "coreTable/OwidTable"
import { ColumnSlug } from "coreTable/CoreTableConstants"
import { AxisConfigInterface } from "grapher/axis/AxisConfigInterface"
import { ColorSchemeName } from "grapher/color/ColorConstants"
import { EntityName } from "coreTable/OwidTableConstants"
import { SelectionArray } from "grapher/selection/SelectionArray"

// The possible options common across our chart types. Not all of these apply to every chart type, so there is room to create a better type hierarchy.

export interface ChartManager {
    baseFontSize?: number

    table: OwidTable
    transformedTable?: OwidTable

    isSelectingData?: boolean
    startSelectingWhenLineClicked?: boolean // used by lineLabels
    isStaticSvg?: boolean
    isRelativeMode?: boolean
    comparisonLines?: ComparisonLineConfig[]
    hideLegend?: boolean
    tooltip?: TooltipProps
    useTimelineDomains?: boolean
    baseColorScheme?: ColorSchemeName
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

    selection?: SelectionArray | EntityName[]
    selectedColumnSlugs?: ColumnSlug[]

    // If you want to use auto-assigned colors, but then have them preserved across selection and chart changes
    seriesColorMap?: SeriesColorMap

    hidePoints?: boolean // for line options
    lineStrokeWidth?: number

    hideXAxis?: boolean
    hideYAxis?: boolean

    facetStrategy?: FacetStrategy // todo: make a strategy? a column prop? etc

    seriesStrategy?: SeriesStrategy
}
