import * as R from "remeda"
import { WORLD_ENTITY_NAME } from "@ourworldindata/grapher/src/core/GrapherConstants.js"

import { COLORS } from "./constants.js"
import {
    EntityData,
    FlowStage,
    FoodSupplyChainMetadata,
    Measure,
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
    measure: Measure
}

const TRADE_STAGE_KEYS: StageKey[] = ["imports", "exports"]

/** Rounds away the float noise that summing the stages leaves in the running balance */
const BALANCE_DECIMAL_PLACES = 9

/** Whether a step adds to the running balance; a step of zero goes by its stage's direction */
export function isAddition(step: WaterfallStep): boolean {
    return step.delta === 0 ? step.direction === "in" : step.delta > 0
}

export function chooseStepColor(step: WaterfallStep, isTotal: boolean): string {
    if (isTotal) return COLORS.total
    if (step.delta === 0) return COLORS.unchanged
    return isAddition(step) ? COLORS.add : COLORS.subtract
}

export function findExcludedStageKeys(entityName: string): StageKey[] {
    return entityName === WORLD_ENTITY_NAME ? TRADE_STAGE_KEYS : []
}

/** Leaves out the stages in `excludedStageKeys` altogether */
export function buildWaterfall({
    metadata,
    entityData,
    measure,
    year,
    excludedStageKeys = [],
}: {
    metadata: FoodSupplyChainMetadata
    entityData: EntityData
    measure: Measure
    year: number
    excludedStageKeys?: StageKey[]
}): Waterfall | undefined {
    const yearIndex = entityData.years.indexOf(year)
    if (yearIndex === -1) return undefined

    const values = entityData.values[measure]

    let balance = 0
    const steps: WaterfallStep[] = metadata.flowStages
        .filter((stage) => !excludedStageKeys.includes(stage.key))
        .map((stage) => {
            const value = values[stage.key][yearIndex]
            const delta = stage.direction === "in" ? value : -value
            const balanceBefore = balance
            balance = R.round(balance + delta, BALANCE_DECIMAL_PLACES)
            return {
                key: stage.key,
                name: stage.name,
                direction: stage.direction,
                delta,
                balanceBefore,
                balanceAfter: balance,
            }
        })

    const totalValue = values[metadata.totalStage.key][yearIndex]
    const total = {
        key: metadata.totalStage.key,
        name: metadata.totalStage.name,
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
        measure,
    }
}
