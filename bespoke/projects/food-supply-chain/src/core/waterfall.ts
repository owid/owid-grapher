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

const BALANCE_DECIMAL_PLACES = 9

export function chooseStepColor(step: WaterfallStep, isTotal: boolean): string {
    if (isTotal) return COLORS.total
    if (step.delta === 0) return COLORS.unchanged
    return isAddition(step) ? COLORS.add : COLORS.subtract
}

export function findExcludedStageKeys(entityName: string): StageKey[] {
    return entityName === WORLD_ENTITY_NAME ? TRADE_STAGE_KEYS : []
}

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

    const runningSteps = metadata.flowStages
        .filter((stage) => !excludedStageKeys.includes(stage.key))
        .reduce<WaterfallStep[]>((steps, stage) => {
            const value = values[stage.key][yearIndex]
            const delta = stage.direction === "in" ? value : -value
            const balanceBefore = steps.at(-1)?.balanceAfter ?? 0
            const step = {
                key: stage.key,
                name: stage.name,
                direction: stage.direction,
                delta,
                balanceBefore,
                balanceAfter: R.round(
                    balanceBefore + delta,
                    BALANCE_DECIMAL_PLACES
                ),
            }
            return [...steps, step]
        }, [])

    const totalValue = values[metadata.totalStage.key][yearIndex]
    const steps = closeLastStepToTotal(runningSteps, totalValue)
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

function closeLastStepToTotal(
    steps: WaterfallStep[],
    totalValue: number
): WaterfallStep[] {
    const lastStep = steps.at(-1)
    if (!lastStep) return steps
    const closedStep = {
        ...lastStep,
        delta: R.round(
            totalValue - lastStep.balanceBefore,
            BALANCE_DECIMAL_PLACES
        ),
        balanceAfter: totalValue,
    }
    return [...steps.slice(0, -1), closedStep]
}

function isAddition(step: WaterfallStep): boolean {
    return step.delta === 0 ? step.direction === "in" : step.delta > 0
}
