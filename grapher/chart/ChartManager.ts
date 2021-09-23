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
import { AxisConfigInterface } from "../axis/AxisConfigInterface"
import { ColorSchemeName } from "../color/ColorConstants"
import { EntityName } from "../../coreTable/OwidTableConstants"
import { SelectionArray } from "../selection/SelectionArray"
import { Annotation, ColumnSlug, SortConfig } from "../../clientUtils/owidTypes"
import { CategoricalBin } from "../color/ColorScaleBin"

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
    tooltip?: TooltipProps
    useTimelineDomains?: boolean
    baseColorScheme?: ColorSchemeName
    invertColorScheme?: boolean
    compareEndPointsOnly?: boolean
    zoomToSelection?: boolean
    matchingEntitiesOnly?: boolean

    colorScale?: Readonly<ColorScaleConfigInterface>

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

    facetStrategy?: FacetStrategy // todo: make a strategy? a column prop? etc

    sortConfig?: SortConfig
    showNoDataArea?: boolean

    seriesStrategy?: SeriesStrategy

    annotation?: Annotation
    resetAnnotation?: () => void

    externalLegendFocusBin?: CategoricalBin | undefined // TODO allow NumericBin in the future
}
