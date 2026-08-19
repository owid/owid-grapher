export type VariantName = "sankey"

export const SEXES = ["both", "female", "male"] as const

export type Sex = (typeof SEXES)[number]

export type Entity = {
    id: number
    name: string
    /** Population at each time-point in metadata.times, same length. */
    population: number[]
}

export type GenderOption = { id: number; name: string }

export type MigrationMetadata = {
    times: number[]
    source: string
    entities: Entity[]
    genders: GenderOption[]
}

export type MigrationRow = {
    partner: string
    year: number
    sex: Sex
    value: number
}

export type MigrationData = {
    country: string
    immigrants: MigrationRow[]
    emigrants: MigrationRow[]
}

/** One immigrants/emigrants row already filtered to the active year+sex,
 *  with the partner resolved to a name. Domain type passed from
 *  MigrationChart into MigrationSankey. */
export type MigrationFlow = {
    /** Origin (immigrants) or destination (emigrants) country name. */
    partner: string
    value: number
}

export const MIGRATION_VIEWS = ["both", "immigrants", "emigrants"] as const

export type MigrationView = (typeof MIGRATION_VIEWS)[number]

// Raw shape returned by the metadata endpoint.
export type RawMetadata = {
    timeRange: { start: number; end: number }
    years: number[]
    source: string
    dimensions: {
        entities: { id: number; name: string; population: number[] }[]
        genders: { id: number; name: string }[]
    }
}

// Raw shape returned per country: two blocks of parallel arrays.
export type RawSeries = {
    entities: number[]
    years: number[]
    genders: number[]
    values: number[]
}
export type RawCountry = { immigrants: RawSeries; emigrants: RawSeries }
