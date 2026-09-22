import { useMemo } from "react"
import { QueryClient, QueryStatus, useQuery } from "@tanstack/react-query"

import { fetchJson } from "@ourworldindata/utils"

import { parseEntityData, parseManifest } from "./parse.js"
import {
    EntityData,
    EntityJson,
    FoodSupplyChainManifest,
    ManifestJson,
} from "./types.js"

export const queryClient = new QueryClient()

const queryKeys = {
    manifest: () => ["food-supply-chain", "manifest"] as const,
    entity: (entityId: number | undefined) =>
        ["food-supply-chain", "entity", entityId] as const,
}

export const useFoodSupplyChainManifest = (
    metadataUrl: string
): {
    data?: FoodSupplyChainManifest
    status: QueryStatus
} => {
    const result = useQuery({
        queryKey: queryKeys.manifest(),
        queryFn: () => fetchJson<ManifestJson>(metadataUrl),
        staleTime: Infinity, // Never refetch
    })

    const data = useMemo(
        () => (result.data ? parseManifest(result.data) : undefined),
        [result.data]
    )
    return { data, status: result.status }
}

export const useEntityData = (
    entityId: number | undefined,
    dataUrl: string
): {
    data?: EntityData
    status: QueryStatus
    isPlaceholderData: boolean
} => {
    const url = `${dataUrl}/food-supply-chain.${entityId}.json`
    const result = useQuery({
        queryKey: queryKeys.entity(entityId),
        queryFn: () => fetchJson<EntityJson>(url),
        enabled: entityId !== undefined,
        staleTime: Infinity, // Never refetch
        // Keep the previous entity on screen while a new one loads, so
        // entity switches don't flash the skeleton.
        placeholderData: (previousData) => previousData,
    })

    const data = useMemo(
        () => (result.data ? parseEntityData(result.data) : undefined),
        [result.data]
    )

    return {
        data,
        status: result.status,
        isPlaceholderData: result.isPlaceholderData,
    }
}
