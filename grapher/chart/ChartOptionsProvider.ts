import { AxisConfig } from "grapher/axis/AxisConfig"
import { ColorScaleConfigInterface } from "grapher/color/ColorScaleConfig"
import { AddCountryMode } from "grapher/core/GrapherConstants"
import { ComparisonLineConfig } from "grapher/scatterCharts/ComparisonLine"
import { TooltipProps } from "grapher/tooltip/TooltipProps"
import { AbstractColumn, OwidTable } from "owidTable/OwidTable"

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

    colorScale?: ColorScaleConfigInterface

    yAxis?: AxisConfig // just pass interface?
    xAxis?: AxisConfig // just pass interface?
    addCountryMode?: AddCountryMode

    yColumn?: AbstractColumn
    yColumns?: AbstractColumn[]
    xColumn?: AbstractColumn
    sizeColumn?: AbstractColumn
    colorColumn?: AbstractColumn
}
