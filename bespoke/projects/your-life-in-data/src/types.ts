export type VariantName = "app" | "controls" | "card"

export type MetricFormat =
    | "pct"
    | "usd"
    | "years"
    | "index"
    | "kg"
    | "tonnes"
    | "number"

/** A curated metric as baked into curated-global.json / curated-refinements.json */
export interface CuratedMetric {
    /** OWID grapher chart slug, e.g. "life-expectancy" */
    slug: string
    /** Column short name in the chart's filtered CSV holding the value */
    valueColumn?: string
    label: string
    /** One of OWID's 10 top-level topic areas, e.g. "Health" */
    subtopic: string
    format?: MetricFormat
    /** false = absolute total / global-only series; don't overlay a comparison entity */
    comparable?: boolean
    /** Which way is better; "none" (or absent) = no value judgment */
    goodDirection?: "up" | "down" | "none"
    /** "relative" = the multiple is the story; "absolute" = change in the metric's own units */
    framing?: "relative" | "absolute"
    unit?: string
    desc?: string
    source?: string
}

/** curated-global.json — the country-agnostic ranked spine */
export interface CuratedGlobal {
    model?: string
    topics: Record<string, CuratedMetric[]>
    highlights: CuratedMetric[]
}

/** curated-refinements.json — per-country edits to the spine, per topic */
export interface RefinementEntry {
    exclude?: { slug: string; reason?: string }[]
    promote?: CuratedMetric[]
}

export interface Refinements {
    model?: string
    countries: Record<string, Record<string, RefinementEntry>>
}

/** countries.json — baked country list with comparison-entity lookups */
export interface CountryInfo {
    code: string
    name: string
    /** OWID continent entity code, e.g. "OWID_EUR" */
    continent?: string
    /** OWID income-group entity code, e.g. "OWID_HIC" */
    income?: string
}

/** [year, value] */
export type SeriesPoint = [number, number]

export interface MetricSeries {
    country: SeriesPoint[]
    comp: SeriesPoint[]
}

export type RowTone = "good" | "warn" | "neutral"

/** One computed card row: a metric's then→now change over this person's lifetime */
export interface CardRow {
    meta: CuratedMetric
    tone: RowTone
    thenYear: number
    nowYear: number
    then: number
    now: number
    compThen: number | null
    compNow: number | null
    /** The country's series, trimmed to the lifetime */
    country: SeriesPoint[]
    /** The comparison entity's series, trimmed to the lifetime */
    comp: SeriesPoint[]
    /** The one-line change summary, e.g. "≈ doubled" or "+12.3 years" */
    phrase: string
}
