import * as React from "react"
import { CoreColumn } from "@ourworldindata/core-table"
import {
    GrapherTooltipAnchor,
    TickFormattingOptions,
} from "@ourworldindata/utils"
import { IObservableValue } from "mobx"

// We can't pass the property directly because we need it to be observable.
export interface TooltipManager {
    tooltip?: IObservableValue<TooltipProps | undefined>
}

export type TooltipFadeMode = "delayed" | "immediate" | "none"
export enum TooltipFooterIcon {
    notice = "notice",
    stripes = "stripes",
    significance = "significance",
    none = "none",
}

export interface TooltipProps {
    id: number | string
    x?: number
    y?: number
    offsetX?: number
    offsetY?: number
    offsetXDirection?: "left" | "right"
    offsetYDirection?: "upward" | "downward"
    title?: string | number // header text
    titleAnnotation?: string // rendered next to the title, but muted
    subtitle?: string | number // header deck
    subtitleFormat?: "notice" | "unit" // optional postprocessing for subtitle
    footer?: { icon: TooltipFooterIcon; text: string }[]
    style?: React.CSSProperties // css overrides (particularly width/maxWidth)
    dissolve?: TooltipFadeMode // flag that the tooltip should begin fading out
    tooltipManager: TooltipManager
    children?: React.ReactNode
    dismiss?: () => void
}

export interface TooltipValueProps {
    column: CoreColumn
    value?: number | string
    color?: string
    notice?: number | string // actual year data was drawn from (when ≠ target year)
    showSignificanceSuperscript?: boolean // show significance-s superscript if applicable
}

export interface TooltipValueRangeProps {
    column: CoreColumn
    values: number[]
    color?: string
    notice?: (number | string | undefined)[] // actual year data was drawn from (when ≠ target year)
    showSignificanceSuperscript?: boolean // show significance-s superscript if applicable
}

export interface TooltipTableProps {
    columns: CoreColumn[]
    rows: TooltipTableRow[]
    totals?: (number | undefined)[]
    format?: TickFormattingOptions
}

export interface TooltipTableRow {
    name: string
    annotation?: string
    swatch?: {
        color?: string // css color string for the series's swatch
        opacity?: number
    }
    focused?: boolean // highlighted (based on hovered series in chart)
    blurred?: boolean // greyed out (typically due to missing data)
    striped?: boolean // use textured swatch (to show data is extrapolated)
    notice?: string | number // actual year data was drawn (when ≠ target year)
    values: (string | number | undefined)[]
}

export interface TooltipTableData {
    value: number
    fake?: boolean
}

export const TooltipContext = React.createContext<{
    anchor?: GrapherTooltipAnchor
}>({})
