import * as React from "react"
import {
    GrapherTooltipAnchor,
    GrapherTrendArrowDirection,
} from "@ourworldindata/utils"
import { IObservableValue } from "mobx"

export interface TooltipManager {
    // We can't pass the property directly because we need it to be observable
    tooltip?: IObservableValue<TooltipProps | undefined>
}

/**
 * Controls the fade transition behavior for tooltips.
 * - "delayed": Good for charts with gaps between targetable areas
 * - "immediate": Better if the tooltip is displayed for all points in the chart's bounds
 * - "none": Disables the fade transition altogether
 */
export type TooltipFadeMode = "delayed" | "immediate" | "none"

export enum TooltipFooterIcon {
    Notice = "notice",
    Stripes = "stripes",
    Significance = "significance",
    None = "none",
}

export interface FooterItem {
    icon: TooltipFooterIcon
    text: string
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
    footer?: FooterItem[]
    style?: React.CSSProperties // css overrides (particularly width/maxWidth)
    dissolve?: TooltipFadeMode // flag that the tooltip should begin fading out
    children?: React.ReactNode
    dismiss?: () => void
}

export interface TooltipValueProps {
    label?: string
    unit?: string
    value?: string
    color?: string
    isProjection?: boolean
    originalTime?: string // actual year data was drawn from (when ≠ target year)
    isRoundedToSignificantFigures?: boolean
    showSignificanceSuperscript?: boolean // show significance-s superscript if applicable
    labelVariant?: "label+unit" | "unit-only"
}

export interface TooltipValueRangeProps {
    label?: string
    unit?: string
    values: [string | undefined, string | undefined]
    trend?: GrapherTrendArrowDirection
    colors?: string[] // value colors, matched by indices
    originalTimes?: (string | undefined)[] // actual year data was drawn from (when ≠ target year)
    isRoundedToSignificantFigures?: boolean
    showSignificanceSuperscript?: boolean // show significance-s superscript if applicable
    labelVariant?: "label+unit" | "unit-only"
}

export interface TooltipTableProps {
    columns: TooltipTableColumn[]
    rows: TooltipTableRow[]
    totals?: (number | undefined)[]
}

interface TooltipTableColumn {
    label: string
    formatValue: (value: unknown) => string
}

interface TooltipTableRow {
    name: string
    annotation?: string
    swatch?: {
        color?: string // css color string for the series's swatch
        opacity?: number
    }
    focused?: boolean // highlighted (based on hovered series in chart)
    blurred?: boolean // greyed out (typically due to missing data)
    striped?: boolean // use textured swatch (to show data is extrapolated)
    originalTime?: string // actual year data was drawn (when ≠ target year)
    values: (string | number | undefined)[]
}

export interface TooltipVariableProps {
    label?: string
    unit?: string
    color?: string
    isProjection?: boolean
    originalTimes?: (string | undefined)[]
    labelVariant?: "label+unit" | "unit-only"
    children?: React.ReactNode
}

export interface TooltipTableData {
    value: number
    fake?: boolean
}

export interface TooltipContainerProps {
    containerBounds?: { width: number; height: number }
    anchor?: GrapherTooltipAnchor
}

export const TooltipContext = React.createContext<
    Pick<TooltipContainerProps, "anchor">
>({})
