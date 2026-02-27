import { GRAPHER_OPACITY_MUTED } from "../core/GrapherConstants.js"
import { Emphasis } from "../interaction/Emphasis.js"

// Minimum vertical space between two legend items
export const LEGEND_ITEM_MIN_SPACING = 4
// Horizontal distance from the end of the chart to the start of the marker
export const MARKER_MARGIN = 4
// Space between the label and the annotation
export const ANNOTATION_PADDING = 1

export const DEFAULT_CONNECTOR_LINE_WIDTH = 25
export const DEFAULT_FONT_WEIGHT = 400

export interface LabelStyleConfig {
    opacity: number
    connectorLineColor: string
}

const DEFAULT_LABEL_STYLE: LabelStyleConfig = {
    opacity: 1,
    connectorLineColor: "#999",
}

export const LABEL_STYLE: Record<Emphasis, LabelStyleConfig> = {
    [Emphasis.Default]: DEFAULT_LABEL_STYLE,
    [Emphasis.Highlighted]: DEFAULT_LABEL_STYLE,
    [Emphasis.Muted]: {
        opacity: GRAPHER_OPACITY_MUTED,
        connectorLineColor: "#eee",
    },
}
