export type VariantName = "waterfall"

export const MEASURES = ["energy", "protein"] as const
export type Measure = (typeof MEASURES)[number]

export const SHORT_UNIT_BY_MEASURE: Record<Measure, string> = {
    energy: "kcal",
    protein: "g",
}

export const NUM_DECIMAL_PLACES_BY_MEASURE: Record<Measure, number> = {
    energy: 0,
    protein: 1,
}

/** Whether a value label short of room may put its unit on a line of its own */
export const IS_UNIT_WRAPPABLE_BY_MEASURE: Record<Measure, boolean> = {
    energy: true,
    protein: false,
}

/** Keys as the manifest spells them; the set is not known at compile time */
export type StageKey = string

export interface FlowStage {
    key: StageKey
    name: string
    direction: "in" | "out"
}

export interface FoodSupplyChainEntity {
    id: number
    name: string
    slug: string
}

export interface FoodSupplyChainManifest {
    flowStages: FlowStage[]
    totalStage: { key: StageKey; name: string }
    sources: string[]
    method: string
    entities: FoodSupplyChainEntity[]
    entityBySlug: Map<string, FoodSupplyChainEntity>
    entityByName: Map<string, FoodSupplyChainEntity>
}

export interface EntityData {
    years: number[]
    values: Record<Measure, Record<StageKey, number[]>>
}

export type ManifestJson = {
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
