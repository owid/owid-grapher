import { useMemo } from "react"
import { QueryClient, QueryStatus, useQuery } from "@tanstack/react-query"

import { fetchJson } from "@ourworldindata/utils"

import { STAGE_LABELS } from "./stages.js"
import {
    EntityData,
    EntityJson,
    FlowStage,
    FoodSupplyChainMetadata,
    MetadataJson,
} from "./types.js"

export const queryClient = new QueryClient()

const queryKeys = {
    metadata: () => ["food-supply-chain", "metadata"] as const,
    entity: (entityId: number | undefined) =>
        ["food-supply-chain", "entity", entityId] as const,
}

export const useFoodSupplyChainMetadata = (
    metadataUrl: string
): {
    data?: FoodSupplyChainMetadata
    status: QueryStatus
} => {
    const result = useQuery({
        queryKey: queryKeys.metadata(),
        queryFn: () => fetchJson<MetadataJson>(metadataUrl),
        staleTime: Infinity,
    })

    const data = useMemo(
        () => (result.data ? parseMetadata(result.data) : undefined),
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
        staleTime: Infinity,
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

export function parseMetadata(raw: MetadataJson): FoodSupplyChainMetadata {
    const flowStages: FlowStage[] = []
    let totalStage: { key: string; name: string } | undefined
    for (const stage of raw.stages) {
        const { key, direction } = stage
        const name = STAGE_LABELS[key] ?? stage.name
        if (direction === "total") totalStage = { key, name }
        else if (direction === "in" || direction === "out")
            flowStages.push({ key, name, direction })
        else throw new Error(`Unknown stage direction: "${direction}"`)
    }
    if (!totalStage) throw new Error("Metadata has no total stage")

    const entities = raw.dimensions.entities
        .map(({ id, name }) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name))

    return {
        flowStages,
        totalStage,
        sources: raw.sources,
        method: raw.method,
        entities,
        entityByName: new Map(entities.map((entity) => [entity.name, entity])),
        entityNames: new Set(entities.map((entity) => entity.name)),
    }
}

export function parseEntityData(raw: EntityJson): EntityData {
    return {
        years: raw.years,
        values: {
            energy: raw.energy,
            protein: raw.protein,
        },
    }
}
