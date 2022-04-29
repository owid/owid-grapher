import { ColorScaleConfigInterface } from "../color/ColorScaleConfig.js"
import {
    EntitySelectionMode,
    FacetStrategy,
    SeriesColorMap,
    SeriesStrategy,
} from "../core/GrapherConstants.js"
import { ComparisonLineConfig } from "../scatterCharts/ComparisonLine.js"
import { TooltipManager } from "../tooltip/TooltipProps.js"
import { OwidTable } from "../../coreTable/OwidTable.js"
import { AxisConfigInterface } from "../axis/AxisConfigInterface.js"
import { ColorSchemeName } from "../color/ColorConstants.js"
import { EntityName } from "../../coreTable/OwidTableConstants.js"
import { SelectionArray } from "../selection/SelectionArray.js"
import {
    Annotation,
    ColumnSlug,
    SortConfig,
} from "../../clientUtils/owidTypes.js"
import { ColorScaleBin } from "../color/ColorScaleBin.js"
import { CoreColumn } from "../../coreTable/CoreTableColumns.js"
import { TimeBound } from "../../clientUtils/TimeBounds.js"
import { ColorScale } from "../color/ColorScale.js"

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
    useTimelineDomains?: boolean
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
    selectedColumnSlugs?: ColumnSlug[]
    yColumnSlugsInSelectionOrder?: ColumnSlug[]

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
