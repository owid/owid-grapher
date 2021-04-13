import { AxisConfig } from "../axis/AxisConfig"
import { ColorScaleConfigInterface } from "../color/ColorScaleConfig"
import {
    EntitySelectionMode,
    FacetStrategy,
    SeriesColorMap,
    SeriesStrategy,
} from "../core/GrapherConstants"
import { ComparisonLineConfig } from "../scatterCharts/ComparisonLine"
import { TooltipProps } from "../tooltip/TooltipProps"
import { OwidTable } from "../../coreTable/OwidTable"
import { ColumnSlug } from "../../coreTable/CoreTableConstants"
import { AxisConfigInterface } from "../axis/AxisConfigInterface"
import { ColorSchemeName } from "../color/ColorConstants"
import { EntityName } from "../../coreTable/OwidTableConstants"
import { SelectionArray } from "../selection/SelectionArray"

// The possible options common across our chart types. Not all of these apply to every chart type, so there is room to create a better type hierarchy.

export interface ChartManager {
    readonly baseFontSize?: number

    readonly table: OwidTable
    readonly transformedTable?: OwidTable

    readonly startSelectingWhenLineClicked?: boolean // used by lineLabels
    readonly isExportingtoSvgOrPng?: boolean
    readonly isRelativeMode?: boolean
    readonly comparisonLines?: readonly ComparisonLineConfig[]
    readonly hideLegend?: boolean
    readonly tooltip?: TooltipProps
    readonly useTimelineDomains?: boolean
    readonly baseColorScheme?: ColorSchemeName
    readonly invertColorScheme?: boolean
    readonly zoomToSelection?: boolean
    readonly matchingEntitiesOnly?: boolean

    readonly colorScale?: ColorScaleConfigInterface

    readonly yAxis?: AxisConfig // Remove? Just pass interfaces?
    readonly xAxis?: AxisConfig
    readonly yAxisConfig?: AxisConfigInterface
    readonly xAxisConfig?: AxisConfigInterface

    readonly addCountryMode?: EntitySelectionMode

    readonly yColumnSlug?: ColumnSlug
    readonly yColumnSlugs?: readonly ColumnSlug[]
    readonly xColumnSlug?: ColumnSlug
    readonly sizeColumnSlug?: ColumnSlug
    readonly colorColumnSlug?: ColumnSlug

    readonly selection?: SelectionArray | readonly EntityName[]
    readonly selectedColumnSlugs?: readonly ColumnSlug[]

    // If you want to use auto-assigned colors, but then have them preserved across selection and chart changes
    readonly seriesColorMap?: SeriesColorMap

    readonly hidePoints?: boolean // for line options
    readonly lineStrokeWidth?: number

    readonly hideXAxis?: boolean
    readonly hideYAxis?: boolean

    readonly facetStrategy?: FacetStrategy // todo: make a strategy? a column prop? etc
    readonly seriesStrategy?: SeriesStrategy

    isSelectingData?: boolean
    compareEndPointsOnly?: boolean
}
