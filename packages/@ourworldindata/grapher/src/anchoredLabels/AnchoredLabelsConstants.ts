import { Emphasis } from "../interaction/Emphasis.js"
import { GRAPHER_OPACITY_MUTED } from "../core/GrapherConstants.js"

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
        [Emphasis.Muted]: { opacity: GRAPHER_OPACITY_MUTED },
    }
