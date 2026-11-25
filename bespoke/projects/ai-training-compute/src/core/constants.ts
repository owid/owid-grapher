export type VariantName = "scatter" | "tutorial"

/** One row of src/data/notableAiModels.json, as exported by scripts/buildData.sql */
export interface RawAiModel {
    model: string
    /** Comma-separated when several organizations co-developed the model */
    organization: string | null
    /** Comma-separated, one entry per organization (Industry, Academia, …) */
    organizationCategory: string | null
    /** YYYY-MM-DD */
    date: string
    trainingComputeFlop: number
    /** Comma-separated (Reported, Operation counting, Hardware, …) */
    computeEstimationMethod: string | null
    link: string | null
    /** Comma-separated (Language, Vision, Multimodal, …) */
    domain: string | null
    confidence: string | null
    /** In Epoch's "notable models" set (meets its notability criteria) */
    isNotable: boolean
    /** In Epoch's "frontier models" set (top 5 by training compute when released) */
    isFrontier: boolean
}

export interface AiModel {
    model: string
    organization: string
    groups: Record<ColorScheme, string>
    date: Date
    /** Fractional year, used as the x position */
    year: number
    trainingComputeFlop: number
    computeEstimationMethod?: string
    link?: string
    domain?: string
    confidence?: string
    isNotable: boolean
    isFrontier: boolean
}

export const COLOR_SCHEMES = [
    "organization",
    "domain",
    "sector",
    "computeStatus",
] as const
export type ColorScheme = (typeof COLOR_SCHEMES)[number]

/** Which of Epoch's model sets the scatter shows */
export const MODEL_SETS = ["frontier", "notable"] as const
export type ModelSet = (typeof MODEL_SETS)[number]

/** Seconds in the one-month run every human and computer comparison uses */
export const SECONDS_PER_MONTH = 30 * 24 * 60 * 60

/** Full extent of the time axis; the range slider zooms within it */
export const FIRST_YEAR = 1940
// Leave room for models released later in the current year
export const LAST_YEAR = new Date().getUTCFullYear() + 1
