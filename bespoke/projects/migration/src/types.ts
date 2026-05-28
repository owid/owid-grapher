export type VariantName = "sankey"

// Genders, with id matching the metadata file.
export const GENDER_ALL = 1
export const GENDER_FEMALE = 2
export const GENDER_MALE = 3
export type GenderId =
    | typeof GENDER_ALL
    | typeof GENDER_FEMALE
    | typeof GENDER_MALE

export type Entity = {
    id: number
    name: string
    /** Population at each time-point in metadata.times, same length. */
    population: number[]
}

export type Gender = { id: number; name: string }

export type MigrationMetadata = {
    times: number[]
    source: string
    entities: Entity[]
    genders: Gender[]
}

export type MigrationRow = {
    /** Partner country id — origin for immigrants, destination for emigrants. */
    partnerId: number
    year: number
    genderId: number
    value: number
}

export type MigrationData = {
    immigrants: MigrationRow[]
    emigrants: MigrationRow[]
}

/** One immigrants/emigrants row already filtered to the active year+gender,
 *  with the partner resolved to a name. Domain type passed from
 *  MigrationChart into MigrationSankey. */
export type MigrationFlow = {
    /** Origin (immigrants) or destination (emigrants) country name. */
    partner: string
    value: number
}

export type MigrationView = "both" | "immigrants" | "emigrants"

// Raw shape returned by the metadata endpoint.
export type RawMetadata = {
    timeRange: { start: number; end: number }
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
