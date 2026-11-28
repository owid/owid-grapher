export type VariantName = "scatter"

/** What the dot colors show, matching the multidim's "Color by" choices */
export const COLOR_BY_OPTIONS = ["reporting", "developer"] as const
export type ColorBy = (typeof COLOR_BY_OPTIONS)[number]

export const Y_SCALE_TYPES = ["log", "linear"] as const
export type YScaleType = (typeof Y_SCALE_TYPES)[number]

/**
 * The multidim the chart takes its data from. Its config names the
 * indicators of each view, so the chart follows them when the dataset is
 * updated and their ids change.
 */
export const MULTIDIM_CONFIG_URL =
    "https://ourworldindata.org/multi-dim/notable-ai-models.json"

/** The multidim's view for each color, all with training compute on y */
export const MULTIDIM_VIEWS: Record<ColorBy, Record<string, string>> = {
    reporting: { metric: "compute", color: "reporting" },
    developer: { metric: "compute", color: "developer" },
}

export interface AiModel {
    /** Entity name in the OWID data: Epoch AI's model name */
    model: string
    date: Date
    /** Fractional year, used as the x position */
    year: number
    trainingComputeFlop: number
    /** "Reported by the developer" or "Estimated by Epoch AI" */
    reporting?: string
    /** Google, Meta, OpenAI, Anthropic, xAI or Other */
    developer?: string
    /** Epoch AI's confidence in the estimate: Confident, Likely or Speculative */
    confidence?: string
}

export const NARROW_BREAKPOINT = 600
