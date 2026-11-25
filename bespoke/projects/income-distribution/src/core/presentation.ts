import type { ReactNode } from "react"

import type { AnnotationPlacement } from "./annotations.js"

/** Text placed relative to a point of the chart (see AnnotationPlacement) */
export interface ChartAnnotation extends AnnotationPlacement {
    key: string
    content: ReactNode
}

/**
 * How the chart presents itself beyond the data: what it emphasises, which
 * labels and annotations it draws, and what the reader may do to the poverty
 * line, e.g. while a walkthrough explains it. Everything is off, or at its
 * default, when unset.
 */
export interface ChartPresentation {
    /** Draw the areas very faded, as a backdrop */
    ghostSeries?: boolean
    /** Global view: outline the top of the stack, optionally labelled at its peak */
    outlineTotal?: { label?: string }
    /** Global view, with a poverty line: fill the whole stack below the line */
    fillBelowLine?: boolean
    /** Label the regions in their bands, or the countries above their curves; default true */
    showSeriesLabels?: boolean
    /** Labels at either end of the x axis, e.g. "Poorest" and "Richest" */
    axisEndLabels?: { left: string; right: string }
    annotations?: ChartAnnotation[]
    /** A lighter line under the poverty line's label, e.g. how to move it */
    povertyLineHint?: string
    /** The line can't be dragged or moved by key; default false */
    isPovertyLineFixed?: boolean
    /**
     * Whether hovering shows the tooltip and a click sets the line; default
     * true. Dragging an existing line works either way.
     */
    isInteractive?: boolean
}

/**
 * Which legend the frame shows. `auto` is the chart's own: the region or
 * country swatches, turning into the share bars once a poverty line is set.
 * `swatches` keeps the swatches whatever the line; `hidden` shows none.
 */
export type FrameLegendMode = "auto" | "swatches" | "hidden"

/**
 * Where the countries view's "Edit countries" goes: `auto` is a button over
 * the plot's corner (in the row above the plot on narrow charts), `legend`
 * a link at the bottom of the overlay legend, `hidden` nowhere
 */
export type FrameEditCountriesMode = "auto" | "legend" | "hidden"
