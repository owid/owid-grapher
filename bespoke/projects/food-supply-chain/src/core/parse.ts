import { getRegionByName, slugify } from "@ourworldindata/utils"

import {
    EntityData,
    EntityJson,
    FlowStage,
    FoodSupplyChainManifest,
    ManifestJson,
} from "./types.js"

export function parseManifest(raw: ManifestJson): FoodSupplyChainManifest {
    const flowStages: FlowStage[] = []
    let totalStage: { key: string; name: string } | undefined
    for (const stage of raw.stages) {
        const { key, name, direction } = stage
        if (direction === "total") totalStage = { key, name }
        else if (direction === "in" || direction === "out")
            flowStages.push({ key, name, direction })
        else throw new Error(`Unknown stage direction: "${direction}"`)
    }
    if (!totalStage) throw new Error("Manifest has no total stage")

    const entities = raw.dimensions.entities.map((entity) => ({
        id: entity.id,
        name: entity.name,
        slug: getRegionByName(entity.name)?.slug ?? slugify(entity.name),
    }))

    return {
        flowStages,
        totalStage,
        units: raw.units,
        sources: raw.sources,
        method: raw.method,
        entities,
        entityBySlug: new Map(entities.map((entity) => [entity.slug, entity])),
        entityByName: new Map(entities.map((entity) => [entity.name, entity])),
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
