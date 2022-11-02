import { ColorScaleConfigInterface } from "../color/ColorScaleConfig"
import {
    EntitySelectionMode,
    FacetStrategy,
    SeriesColorMap,
    SeriesStrategy,
} from "../core/GrapherConstants"
import { ComparisonLineConfig } from "../scatterCharts/ComparisonLine"
import { TooltipManager } from "../tooltip/TooltipProps"
import { OwidTable } from "@ourworldindata/core-table"
import { AxisConfigInterface } from "../axis/AxisConfigInterface"
import { ColorSchemeName } from "../color/ColorConstants"
import { EntityName, CoreColumn } from "@ourworldindata/core-table"
import { SelectionArray } from "../selection/SelectionArray"
import {
    Annotation,
    ColumnSlug,
    SortConfig,
    TimeBound,
} from "@ourworldindata/utils"
import { ColorScaleBin } from "../color/ColorScaleBin"
import { ColorScale } from "../color/ColorScale"

// The possible options common across our chart types. Not all of these apply to every chart type, so there is room to create a better type hierarchy.

export interface ChartManager {
    baseFontSize?: number

    table: OwidTable
    transformedTable?: OwidTable

    isSelectingData?: boolean
    startSelectingWhenLineClicked?: boolean // used by lineLabels
    isExportingtoSvgOrPng?: boolean
    isRelativeMode?: boolean
    comparisonLines?: ComparisonLineConfig[]
    hideLegend?: boolean
    tooltips?: TooltipManager["tooltips"]
    baseColorScheme?: ColorSchemeName
    invertColorScheme?: boolean
    compareEndPointsOnly?: boolean
    zoomToSelection?: boolean
    matchingEntitiesOnly?: boolean

    colorScale?: Readonly<ColorScaleConfigInterface>
    // for consistent automatic color scales across facets
    colorScaleColumnOverride?: CoreColumn
    // for passing colorScale to sparkline in map charts
    colorScaleOverride?: ColorScale

    yAxisConfig?: Readonly<AxisConfigInterface>
    xAxisConfig?: Readonly<AxisConfigInterface>

    addCountryMode?: EntitySelectionMode

    yColumnSlug?: ColumnSlug
    yColumnSlugs?: ColumnSlug[]
    xColumnSlug?: ColumnSlug
    sizeColumnSlug?: ColumnSlug
    colorColumnSlug?: ColumnSlug

    selection?: SelectionArray | EntityName[]

    // If you want to use auto-assigned colors, but then have them preserved across selection and chart changes
    seriesColorMap?: SeriesColorMap

    hidePoints?: boolean // for line options
    startHandleTimeBound?: TimeBound // for relative-to-first-year line chart

    // we need endTime so DiscreteBarCharts and StackedDiscreteBarCharts can
    // know what date the timeline is set to. and let's pass startTime in, too.
    startTime?: number
    endTime?: number

    facetStrategy?: FacetStrategy // todo: make a strategy? a column prop? etc
    seriesStrategy?: SeriesStrategy

    sortConfig?: SortConfig
    showNoDataArea?: boolean

    annotation?: Annotation
    resetAnnotation?: () => void

    externalLegendFocusBin?: ColorScaleBin | undefined
    disableIntroAnimation?: boolean
}
