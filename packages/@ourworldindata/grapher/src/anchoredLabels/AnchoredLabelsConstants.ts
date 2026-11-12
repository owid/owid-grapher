import { Emphasis } from "../interaction/Emphasis.js"
import { GRAPHER_THUMBNAIL_OPACITY_MUTED } from "../core/GrapherConstants.js"

export interface AnchoredLabelStyleConfig {
    opacity: number
}

const DEFAULT_ANCHORED_LABEL_STYLE: AnchoredLabelStyleConfig = {
    opacity: 1,
}

export const ANCHORED_LABEL_STYLE: Record<Emphasis, AnchoredLabelStyleConfig> =
    {
        [Emphasis.Default]: DEFAULT_ANCHORED_LABEL_STYLE,
        [Emphasis.Elevated]: DEFAULT_ANCHORED_LABEL_STYLE,
        [Emphasis.Highlighted]: DEFAULT_ANCHORED_LABEL_STYLE,
        [Emphasis.Muted]: { opacity: GRAPHER_THUMBNAIL_OPACITY_MUTED },
    }

/** Slack for floating-point error in label position comparisons */
export const FLOAT_TOLERANCE_PX = 0.01

/** How far from the plot edge an anchor can sit and still count as an edge label */
export const EDGE_TOLERANCE_PX = 1

/** Step size when nudging an in-chart label away from collisions */
export const NUDGE_STEP_PX = 0.5
