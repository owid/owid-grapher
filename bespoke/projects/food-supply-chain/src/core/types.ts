import type { BespokeMetadata } from "@ourworldindata/types"

export type VariantName = "waterfall"

export const MEASURES = ["calories", "protein"] as const
export type Measure = (typeof MEASURES)[number]

export type StageKey = string

export interface FlowStage {
    key: StageKey
    name: string
    direction: "in" | "out"
}

export interface FoodSupplyChainEntity {
    id: number
    name: string
}

export interface FoodSupplyChainMetadata {
    flowStages: FlowStage[]
    totalStage: { key: StageKey; name: string }
    sources: string[]
    entities: FoodSupplyChainEntity[]
    entityByName: Map<string, FoodSupplyChainEntity>
    entityNames: Set<string>
    provenance: BespokeMetadata | undefined
}

export interface EntityData {
    years: number[]
    values: Record<Measure, Record<StageKey, number[]>>
}

export type MetadataJson = {
    method: string
    sources: string[]
    timeRange: { start: number; end: number }
    units: Record<string, string>
    stages: { key: string; name: string; direction: string }[]
    dimensions: { entities: { id: number; name: string }[] }
}

export type EntityJson = {
    years: number[]
    energy: Record<string, number[]>
    protein: Record<string, number[]>
}
