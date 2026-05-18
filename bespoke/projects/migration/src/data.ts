import { useQuery } from "@tanstack/react-query"

const BASE_URL = "https://owid-public.owid.io/data/migration"
const METADATA_URL = `${BASE_URL}/migration-stock-flows.metadata.json`
const countryUrl = (entityId: number) =>
    `${BASE_URL}/migration-stock-flows.${entityId}.json`

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

// Raw shape returned by the metadata endpoint.
type RawMetadata = {
    timeRange: { start: number; end: number }
    source: string
    dimensions: {
        entities: { id: number; name: string; population: number[] }[]
        genders: { id: number; name: string }[]
    }
}

// The 8 time-points the data is reported at. Hardcoded because the metadata's
// timeRange only gives endpoints, and the population array is keyed by these
// positions.
const TIMES = [1990, 1995, 2000, 2005, 2010, 2015, 2020, 2024]

const queryKeys = {
    metadata: () => ["migration", "metadata"],
    country: (entityId: number) => ["migration", "country", entityId],
}

export const useMigrationMetadata = () =>
    useQuery({
        queryKey: queryKeys.metadata(),
        queryFn: async (): Promise<MigrationMetadata> => {
            const res = await fetch(METADATA_URL)
            if (!res.ok)
                throw new Error(
                    `Failed to fetch migration metadata: HTTP ${res.status}`
                )
            const raw = (await res.json()) as RawMetadata
            return {
                times: TIMES,
                source: raw.source,
                entities: raw.dimensions.entities,
                genders: raw.dimensions.genders,
            }
        },
        staleTime: Infinity,
    })

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

// Raw shape returned per country: two blocks of parallel arrays.
type RawSeries = {
    entities: number[]
    years: number[]
    genders: number[]
    values: number[]
}
type RawCountry = { immigrants: RawSeries; emigrants: RawSeries }

function decodeSeries(s: RawSeries): MigrationRow[] {
    const out: MigrationRow[] = new Array(s.values.length)
    for (let i = 0; i < s.values.length; i++) {
        out[i] = {
            partnerId: s.entities[i],
            year: s.years[i],
            genderId: s.genders[i],
            value: s.values[i],
        }
    }
    return out
}

export const useMigrationData = (entityId: number | undefined) =>
    useQuery({
        queryKey: queryKeys.country(entityId ?? -1),
        enabled: entityId !== undefined,
        queryFn: async (): Promise<MigrationData> => {
            const res = await fetch(countryUrl(entityId as number))
            if (!res.ok)
                throw new Error(
                    `Failed to fetch migration data for entity ${entityId}: HTTP ${res.status}`
                )
            const raw = (await res.json()) as RawCountry
            return {
                immigrants: decodeSeries(raw.immigrants),
                emigrants: decodeSeries(raw.emigrants),
            }
        },
        staleTime: Infinity,
    })
