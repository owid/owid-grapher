import { useQuery } from "@tanstack/react-query"

import {
    Entity,
    MigrationData,
    MigrationMetadata,
    MigrationRow,
    RawCountry,
    RawMetadata,
    RawSeries,
} from "./types.js"
import { sexFromId } from "./helpers.js"

const BASE_URL = "https://owid-public.owid.io/data/migration"
const METADATA_URL = `${BASE_URL}/migration-stock-flows.metadata.json`
const countryUrl = (entityId: number) =>
    `${BASE_URL}/migration-stock-flows.${entityId}.json`

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
                times: raw.years,
                source: raw.source,
                entities: raw.dimensions.entities,
                genders: raw.dimensions.genders,
            }
        },
        staleTime: Infinity,
    })

export const useMigrationData = (
    entityId: number | undefined,
    metadata: MigrationMetadata | undefined
) =>
    useQuery({
        queryKey: queryKeys.country(entityId ?? -1),
        enabled: entityId !== undefined && metadata !== undefined,
        queryFn: async (): Promise<MigrationData> => {
            const res = await fetch(countryUrl(entityId as number))
            if (!res.ok)
                throw new Error(
                    `Failed to fetch migration data for entity ${entityId}: HTTP ${res.status}`
                )
            const raw = (await res.json()) as RawCountry
            return {
                country:
                    metadata?.entities.find((e) => e.id === entityId)?.name ??
                    "",
                immigrants: decodeSeries(raw.immigrants, metadata),
                emigrants: decodeSeries(raw.emigrants, metadata),
            }
        },
        staleTime: Infinity, // Never refetch
        // Keep the previous country on screen while a new one loads,
        // so country switches don't flash the skeleton.
        placeholderData: (previousData) => previousData,
    })

function decodeSeries(
    s: RawSeries,
    metadata?: MigrationMetadata
): MigrationRow[] {
    const entitiesById = new Map<number, Entity>(
        metadata?.entities.map((e) => [e.id, e]) ?? []
    )
    const genders = metadata?.genders ?? []
    const out: MigrationRow[] = new Array(s.values.length)
    for (let i = 0; i < s.values.length; i++) {
        out[i] = {
            partner: entitiesById.get(s.entities[i])?.name ?? "Unknown",
            year: s.years[i],
            sex: sexFromId(s.genders[i], genders),
            value: s.values[i],
        }
    }
    return out
}
