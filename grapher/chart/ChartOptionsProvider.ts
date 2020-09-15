import { ComparisonLineConfig } from "grapher/scatterCharts/ComparisonLine"
import { TooltipProps } from "grapher/tooltip/TooltipProps"
import { OwidTable } from "owidTable/OwidTable"
import { AddCountryMode } from "grapher/core/GrapherConstants"

// NB: Traditionally you would simply have an "Options" class. However, in order to enable our "Reactivity" with Mobx, we term
// our Options as an "Options Provider". To get or set any of the options, you then have to "dot in" to the options provider
// instance. By "dotting in" Mobx will track the reads or trigger actions on writes. You can still also just create plain
// vanilla JS options objects to easily make static charts (without reactivity).
export interface ChartOptionsProvider {
    baseFontSize: number
    hideLegend?: boolean
    showAddEntityControls: boolean
    isSelectingData: boolean
    canAddData: boolean
    entityType: string
    canChangeEntity: boolean
    areMarksClickable: boolean
    isInteractive: boolean
    tooltip?: TooltipProps
    addCountryMode: AddCountryMode
    isRelativeMode: boolean
    table: OwidTable // todo: abstract table?
    comparisonLines: ComparisonLineConfig[]
}
