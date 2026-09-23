import {
    EntityData,
    FlowStage,
    FoodSupplyChainManifest,
    Measure,
    SHORT_UNIT_BY_MEASURE,
    StageKey,
} from "./types.js"

export interface WaterfallStep {
    key: StageKey
    name: string
    direction: FlowStage["direction"]
    delta: number
    balanceBefore: number
    balanceAfter: number
}

export interface Waterfall {
    steps: WaterfallStep[]
    total: { key: StageKey; name: string; value: number }
    domain: [number, number]
    year: number
    shortUnit: string
}

/** Whether a step adds to the running balance; a step of zero goes by its stage's direction */
export function isAddition(step: WaterfallStep): boolean {
    return step.delta === 0 ? step.direction === "in" : step.delta > 0
}

export function buildWaterfall({
    manifest,
    entityData,
    measure,
    year,
}: {
    manifest: FoodSupplyChainManifest
    entityData: EntityData
    measure: Measure
    year: number
}): Waterfall | undefined {
    const yearIndex = entityData.years.indexOf(year)
    if (yearIndex === -1) return undefined

    const values = entityData.values[measure]

    let balance = 0
    const steps: WaterfallStep[] = manifest.flowStages.map((stage) => {
        const value = values[stage.key][yearIndex]
        const delta = stage.direction === "in" ? value : -value
        const balanceBefore = balance
        balance += delta
        return {
            key: stage.key,
            name: stage.name,
            direction: stage.direction,
            delta,
            balanceBefore,
            balanceAfter: balance,
        }
    })

    const totalValue = values[manifest.totalStage.key][yearIndex]
    const total = {
        key: manifest.totalStage.key,
        name: manifest.totalStage.name,
        value: totalValue,
    }

    const ends = steps.map((step) => step.balanceAfter)
    const domain: [number, number] = [
        Math.min(0, ...ends, totalValue),
        Math.max(0, ...ends, totalValue),
    ]

    return {
        steps,
        total,
        domain,
        year,
        shortUnit: SHORT_UNIT_BY_MEASURE[measure],
    }
}
