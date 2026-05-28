import { useQuery } from "@tanstack/react-query"

import {
    MigrationData,
    MigrationMetadata,
    MigrationRow,
    RawCountry,
    RawMetadata,
    RawSeries,
} from "./types.js"

const BASE_URL = "https://owid-public.owid.io/data/migration"
const METADATA_URL = `${BASE_URL}/migration-stock-flows.metadata.json`
const countryUrl = (entityId: number) =>
    `${BASE_URL}/migration-stock-flows.${entityId}.json`

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
        staleTime: Infinity, // Never refetch
        // Keep the previous country on screen while a new one loads,
        // so country switches don't flash the skeleton.
        placeholderData: (previousData) => previousData,
    })

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
