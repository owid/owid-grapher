import * as React from "react"
import {
    EntitySelectionMode,
    FacetStrategy,
    SeriesColorMap,
    SeriesStrategy,
    MissingDataStrategy,
    ColorScaleConfigInterface,
    ComparisonLineConfig,
    AxisConfigInterface,
    ColorSchemeName,
    EntityName,
    DetailsMarker,
    Color,
    GrapherVariant,
} from "@ourworldindata/types"
import { TooltipManager } from "../tooltip/TooltipProps"
import { OwidTable, CoreColumn } from "@ourworldindata/core-table"

import { SelectionArray } from "../selection/SelectionArray"
import { ColumnSlug, SortConfig, TimeBound } from "@ourworldindata/utils"
import { ColorScaleBin } from "../color/ColorScaleBin"
import { ColorScale } from "../color/ColorScale"
import { FocusArray } from "../focus/FocusArray"

// The possible options common across our chart types. Not all of these apply to every chart type, so there is room to create a better type hierarchy.

export interface ChartManager {
    base?: React.RefObject<SVGGElement | HTMLDivElement | null>
    fontSize?: number

    table: OwidTable
    transformedTable?: OwidTable

    variant?: GrapherVariant

    isExportingToSvgOrPng?: boolean
    isRelativeMode?: boolean
    comparisonLines?: ComparisonLineConfig[]
    showLegend?: boolean
    hideLegendsOutsideChartArea?: boolean
    tooltip?: TooltipManager["tooltip"]
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
    // If you want to use auto-assigned colors, but then have them preserved across selection and chart changes
    seriesColorMap?: SeriesColorMap
    // If you want to opt out of assigned colors and use a value-based color scheme instead
    // (e.g. stacked bar charts coloring positive/negative values differently)
    useValueBasedColorScheme?: boolean

    yAxisConfig?: Readonly<AxisConfigInterface>
    xAxisConfig?: Readonly<AxisConfigInterface>

    addCountryMode?: EntitySelectionMode

    yColumnSlug?: ColumnSlug
    yColumnSlugs?: ColumnSlug[]
    xColumnSlug?: ColumnSlug
    sizeColumnSlug?: ColumnSlug
    colorColumnSlug?: ColumnSlug

    // if colorColumnSlug is given, either one of these is set
    categoricalColorColumnSlug?: ColumnSlug
    numericColorColumnSlug?: ColumnSlug

    selection?: SelectionArray | EntityName[]
    entityType?: string

    focusArray?: FocusArray

    hidePoints?: boolean // for line options
    startHandleTimeBound?: TimeBound // for relative-to-first-year line chart
    hideNoDataSection?: boolean // for slope charts

    // we need endTime so DiscreteBarCharts and StackedDiscreteBarCharts can
    // know what date the timeline is set to. and let's pass startTime in, too.
    startTime?: number
    endTime?: number

    facetStrategy?: FacetStrategy // todo: make a strategy? a column prop? etc
    seriesStrategy?: SeriesStrategy

    sortConfig?: SortConfig
    showNoDataArea?: boolean // No data area in Marimekko charts

    externalLegendHoverBin?: ColorScaleBin | undefined
    disableIntroAnimation?: boolean

    missingDataStrategy?: MissingDataStrategy

    isNarrow?: boolean
    isStatic?: boolean
    isSemiNarrow?: boolean
    isStaticAndSmall?: boolean
    isExportingForSocialMedia?: boolean
    isExportingForWikimedia?: boolean
    backgroundColor?: Color
    shouldPinTooltipToBottom?: boolean

    detailsOrderedByReference?: string[]
    detailsMarkerInSvg?: DetailsMarker
}
