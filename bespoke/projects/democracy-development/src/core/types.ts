export const INDEX_KEYS = ["libdem", "electdem", "eiu", "fh"] as const
export type IndexKey = (typeof INDEX_KEYS)[number]

export const OUTCOME_KEYS = [
    "gdp",
    "child_mortality",
    "poverty10",
    "eys",
] as const
export type OutcomeKey = (typeof OUTCOME_KEYS)[number]

export type SeriesKey = IndexKey | OutcomeKey | "population"

/** An entity's position in the manifest's `entities` list, which is how the data file names it */
export type EntityId = number

export type VariantName = "scatter"

/** One origin of a garden column, as the manifest carries it */
export interface FeedOrigin {
    producer?: string
    title?: string
    attribution?: string
    datePublished?: string
    dateAccessed?: string
    urlMain?: string
    citationFull?: string
}

/** One series' block in the manifest: what the bundle needs to read and cite the garden column */
export interface IndicatorMeta {
    name?: string
    titlePublic?: string
    unit: string
    shortUnit: string
    tolerance: number
    numDecimalPlaces?: number
    descriptionShort?: string
    descriptionKey?: string | string[]
    origins: FeedOrigin[]
    timespan?: string
    catalogPath?: string | null
}

/** `democracy-development.metadata.json`, written by the ETL step */
export interface FeedManifest {
    meta: { title: string; source: string; note?: string }
    yearRange: { first: number; last: number }
    continents: string[]
    entities: { name: string; continent: number }[]
    indicators: Record<SeriesKey, IndicatorMeta>
    dataFile: string
}

/** `[year, value]` rows sorted by year */
export type SeriesRows = [number, number][]

/** `democracy-development.data.json`: values by series and entity id */
export interface FeedData {
    series: Partial<Record<SeriesKey, Record<string, SeriesRows>>>
}

/** A value read off a series for a target year, and the year it actually comes from */
export interface Datum {
    value: number
    year: number
}

/** One dot of one panel, in data units and, once laid out, in pixels */
export interface PanelPoint {
    eid: EntityId
    x: number
    y: number
    xYear: number
    yYear: number
    pop: number | null
    px: number
    py: number
}
