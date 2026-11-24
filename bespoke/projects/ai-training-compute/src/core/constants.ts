export type VariantName = "scatter"

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
    link: string | null
    /** Comma-separated (Language, Vision, Multimodal, …) */
    domain: string | null
    confidence: string | null
}

export interface AiModel {
    model: string
    organization: string
    groups: Record<ColorScheme, string>
    date: Date
    /** Fractional year, used as the x position */
    year: number
    trainingComputeFlop: number
    link?: string
    domain?: string
    confidence?: string
}

export const COLOR_SCHEMES = ["organization", "domain", "sector"] as const
export type ColorScheme = (typeof COLOR_SCHEMES)[number]

/** Seconds in the one-month run every human and computer comparison uses */
export const SECONDS_PER_MONTH = 30 * 24 * 60 * 60

/** Full extent of the time axis; the range slider zooms within it */
export const FIRST_YEAR = 1940
// Leave room for models released later in the current year
export const LAST_YEAR = new Date().getUTCFullYear() + 1
