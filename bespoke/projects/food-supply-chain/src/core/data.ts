import { QueryClient, QueryStatus, useQuery } from "@tanstack/react-query"

import { fetchJson } from "@ourworldindata/utils"

import { STAGE_LABELS } from "./stages.js"
import {
    EntityData,
    EntityJson,
    FlowStage,
    FoodSupplyChainEntity,
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
        queryFn: async () =>
            parseMetadata(await fetchJson<MetadataJson>(metadataUrl)),
        staleTime: Infinity,
    })
    return { data: result.data, status: result.status }
}

/** The data of `entity`, or of the previous entity while `entity`'s loads */
export const useEntityData = (
    entity: FoodSupplyChainEntity | undefined,
    dataUrl: string
): {
    data?: EntityData
    /** The entity `data` belongs to */
    dataEntity?: FoodSupplyChainEntity
    status: QueryStatus
    isPlaceholderData: boolean
} => {
    const url = `${dataUrl}/food-supply-chain.${entity?.id}.json`
    const result = useQuery({
        queryKey: queryKeys.entity(entity?.id),
        queryFn: async () => ({
            // The query only runs once there is an entity
            entity: entity!,
            entityData: parseEntityData(await fetchJson<EntityJson>(url)),
        }),
        enabled: entity !== undefined,
        staleTime: Infinity,
        placeholderData: (previousData) => previousData,
    })

    return {
        data: result.data?.entityData,
        dataEntity: result.data?.entity,
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
