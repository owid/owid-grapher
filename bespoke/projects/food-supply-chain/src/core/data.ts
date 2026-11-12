import {
    QueryClient,
    QueryStatus,
    skipToken,
    useQuery,
} from "@tanstack/react-query"

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
import { parseBespokeMetadata } from "../../../../components/MetadataModal/bespokeMetadata.js"

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

export const useEntityData = (
    entity: FoodSupplyChainEntity | undefined,
    dataUrl: string
): {
    data?: EntityData
    dataEntity?: FoodSupplyChainEntity
    status: QueryStatus
    isPlaceholderData: boolean
} => {
    const url = `${dataUrl}/food-supply-chain.${entity?.id}.json`
    const result = useQuery({
        queryKey: queryKeys.entity(entity?.id),
        queryFn: entity
            ? async () => ({
                  entity,
                  entityData: parseEntityData(await fetchJson<EntityJson>(url)),
              })
            : skipToken,
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
    const stages = raw.stages.map((stage) => {
        const { key, direction } = stage
        if (direction !== "total" && direction !== "in" && direction !== "out")
            throw new Error(`Unknown stage direction: "${direction}"`)
        return { key, name: STAGE_LABELS[key] ?? stage.name, direction }
    })
    const flowStages = stages.filter(
        (stage): stage is FlowStage => stage.direction !== "total"
    )
    const totalStage = stages.find((stage) => stage.direction === "total")
    if (!totalStage) throw new Error("Metadata has no total stage")

    const entities = raw.dimensions.entities
        .map(({ id, name }) => ({ id, name }))
        .toSorted((a, b) => a.name.localeCompare(b.name))

    return {
        flowStages,
        totalStage: { key: totalStage.key, name: totalStage.name },
        sources: raw.sources,
        entities,
        entityByName: new Map(entities.map((entity) => [entity.name, entity])),
        entityNames: new Set(entities.map((entity) => entity.name)),
        provenance: parseBespokeMetadata(raw),
    }
}

export function parseEntityData(raw: EntityJson): EntityData {
    return {
        years: raw.years,
        values: {
            calories: raw.energy,
            protein: raw.protein,
        },
    }
}
