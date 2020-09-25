import { AxisConfig } from "grapher/axis/AxisConfig"
import { ColorScaleConfigInterface } from "grapher/color/ColorScaleConfig"
import { EntitySelectionModes } from "grapher/core/GrapherConstants"
import { ComparisonLineConfig } from "grapher/scatterCharts/ComparisonLine"
import { TooltipProps } from "grapher/tooltip/TooltipProps"
import { OwidTable } from "coreTable/OwidTable"
import { ColumnSlug } from "coreTable/CoreTableConstants"

// NB: Traditionally you would simply have an "Options" class. However, in order to enable our "Reactivity" with Mobx, we term
// our Options as an "Options Provider". To get or set any of the options, you then have to "dot in" to the options provider
// instance. By "dotting in" Mobx will track the reads or trigger actions on writes. You can still also just create plain
// vanilla JS options objects to easily make static charts (without reactivity).
export interface ChartOptionsProvider {
    baseFontSize?: number
    table: OwidTable // todo: abstract table?
    entityType?: string
    showAddEntityControls?: boolean
    isSelectingData?: boolean
    canAddData?: boolean
    areMarksClickable?: boolean // used by lineLabels
    canChangeEntity?: boolean
    isInteractive?: boolean
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

    yAxis?: AxisConfig // just pass interface?
    xAxis?: AxisConfig // just pass interface?
    addCountryMode?: EntitySelectionModes

    yColumnSlug?: ColumnSlug
    yColumnSlugs?: ColumnSlug[]
    xColumnSlug?: ColumnSlug
    sizeColumnSlug?: ColumnSlug
    colorColumnSlug?: ColumnSlug

    hidePoints?: boolean // for line options
    lineStrokeWidth?: number

    hideXAxis?: boolean
    hideYAxis?: boolean

    faceting?: boolean // todo: make a strategy? a column prop? etc
}
