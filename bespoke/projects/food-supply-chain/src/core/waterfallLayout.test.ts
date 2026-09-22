import { describe, expect, it } from "vitest"

import { STAGE_GROUPS } from "./stageGroups.js"
import {
    EntityData,
    FlowStage,
    FoodSupplyChainManifest,
    StageKey,
} from "./types.js"
import { buildWaterfall, Waterfall } from "./waterfall.js"
import {
    Box,
    MIN_BAR_LENGTH_PX,
    layOutWaterfall,
    PlacedStep,
} from "./waterfallLayout.js"

const BOX: Box = { x: 10, y: 20, width: 300, height: 200 }

describe(layOutWaterfall, () => {
    it("sits every bar, and the total's bar, inside the box on both axes", () => {
        const waterfall = fixtureWaterfall({
            crop: [100],
            exports: [10],
            tourism: [1],
            food: [89],
        })
        const layout = layOutWaterfall(waterfall, BOX)

        const bars = [...layout.steps, layout.total].flatMap(
            (step) => step.bar ?? []
        )
        expect(bars.length).toBeGreaterThan(0)
        for (const bar of bars) {
            expect(bar.x).toBeGreaterThanOrEqual(BOX.x)
            expect(bar.y).toBeGreaterThanOrEqual(BOX.y)
            expect(bar.x + bar.width).toBeLessThanOrEqual(BOX.x + BOX.width)
            expect(bar.y + bar.height).toBeLessThanOrEqual(BOX.y + BOX.height)
        }
    })

    it("chains each bar to the next at the running balance they share", () => {
        const waterfall = fixtureWaterfall({
            crop: [100],
            exports: [10],
            tourism: [5],
            food: [85],
        })
        const layout = layOutWaterfall(waterfall, BOX)

        const drawn = layout.steps.filter(
            (
                step
            ): step is PlacedStep & { bar: NonNullable<PlacedStep["bar"]> } =>
                step.bar !== undefined
        )
        expect(drawn.length).toBeGreaterThan(1)
        for (let i = 0; i < drawn.length - 1; i++) {
            const sharedY = drawn[i].valueAnchor.y
            expect(hasEdgeAt(drawn[i].bar, sharedY)).toBe(true)
            expect(hasEdgeAt(drawn[i + 1].bar, sharedY)).toBe(true)
        }
    })

    it("floors a step whose delta scales to under half a pixel", () => {
        const waterfall = fixtureWaterfall({
            crop: [100_000],
            exports: [1],
            tourism: [0.001],
            food: [99_999],
        })
        const layout = layOutWaterfall(waterfall, BOX)

        const tourism = layout.steps.find((step) => step.step.key === "tourism")
        expect(tourism?.bar?.isFloored).toBe(true)
        expect(tourism?.bar?.height).toBeCloseTo(MIN_BAR_LENGTH_PX, 6)
    })

    it("draws no bar for a step whose delta is exactly zero, but still places it", () => {
        const waterfall = fixtureWaterfall({
            crop: [100],
            exports: [10],
            tourism: [0],
            food: [90],
        })
        const layout = layOutWaterfall(waterfall, BOX)

        const tourism = layout.steps.find((step) => step.step.key === "tourism")
        expect(tourism?.bar).toBeUndefined()
        expect(tourism?.slot).toBeDefined()
        expect(tourism?.valueAnchor).toBeDefined()
        expect(tourism?.captionAnchor).toBeDefined()
    })

    it("spans each group's band over exactly its own columns", () => {
        const layout = layOutWaterfall(fixtureGroupedWaterfall(), BOX)

        expect(layout.groups.map((placed) => placed.group.key)).toEqual(
            STAGE_GROUPS.map((group) => group.key)
        )
        for (const placed of layout.groups) {
            expect(stepKeysUnderBand(layout.steps, placed.band)).toEqual(
                placed.group.stageKeys
            )
            expect(stepKeysUnderBand([layout.total], placed.band)).toEqual([])
        }
    })

    it("drops a band whose stages are no longer side by side", () => {
        const reordered = MANIFEST_FLOW_STAGES.filter(
            (stage) => stage.key !== "animal_products"
        )
        reordered.unshift(
            MANIFEST_FLOW_STAGES.find(
                (stage) => stage.key === "animal_products"
            )!
        )
        const layout = layOutWaterfall(fixtureGroupedWaterfall(reordered), BOX)

        expect(layout.groups.map((placed) => placed.group.key)).not.toContain(
            "animals"
        )
        expect(layout.groups.map((placed) => placed.group.key)).toContain(
            "adjustments"
        )
    })

    it("puts the zero line strictly inside the box for a domain straddling zero", () => {
        const waterfall = fixtureWaterfall({
            crop: [10],
            exports: [50],
            tourism: [0],
            food: [-40],
        })
        const layout = layOutWaterfall(waterfall, BOX)

        expect(layout.zeroLine.y1).toBeGreaterThan(BOX.y)
        expect(layout.zeroLine.y1).toBeLessThan(BOX.y + BOX.height)
    })
})

function stepKeysUnderBand(
    steps: PlacedStep[],
    band: { x1: number; x2: number }
): StageKey[] {
    return steps
        .filter(
            (step) =>
                step.valueAnchor.x > band.x1 && step.valueAnchor.x < band.x2
        )
        .map((step) => step.step.key)
}

function hasEdgeAt(bar: { y: number; height: number }, y: number): boolean {
    return Math.abs(bar.y - y) < 1e-6 || Math.abs(bar.y + bar.height - y) < 1e-6
}

function fixtureWaterfall(values: Record<StageKey, number[]>): Waterfall {
    const flowStages: FlowStage[] = [
        { key: "crop", name: "Crop production", direction: "in" },
        { key: "exports", name: "Exports", direction: "out" },
        { key: "tourism", name: "Tourist consumption", direction: "out" },
    ]
    const manifest = fixtureManifest(flowStages)
    const entityData = fixtureEntityData([2020], values)
    return buildWaterfall({
        manifest,
        entityData,
        measure: "energy",
        year: 2020,
    })!
}

const MANIFEST_FLOW_STAGES: FlowStage[] = [
    { key: "crop_production", name: "Crop production", direction: "in" },
    { key: "imports", name: "Imports", direction: "in" },
    { key: "exports", name: "Exports", direction: "out" },
    { key: "stock_variation", name: "Stock change", direction: "in" },
    { key: "seed", name: "Seed", direction: "out" },
    { key: "losses", name: "Losses", direction: "out" },
    { key: "other_uses", name: "Non-food uses", direction: "out" },
    { key: "processing_net", name: "Processing, net", direction: "in" },
    { key: "feed", name: "Animal feed", direction: "out" },
    { key: "animal_products", name: "Livestock and fish", direction: "in" },
    {
        key: "tourist_consumption",
        name: "Tourist consumption",
        direction: "out",
    },
    { key: "residuals", name: "Residuals", direction: "out" },
]

function fixtureGroupedWaterfall(
    flowStages: FlowStage[] = MANIFEST_FLOW_STAGES
): Waterfall {
    const values = Object.fromEntries([
        ...flowStages.map((stage) => [stage.key, [10]]),
        ["crop_production", [200]],
        ["food", [140]],
    ])
    return buildWaterfall({
        manifest: fixtureManifest(flowStages),
        entityData: fixtureEntityData([2020], values),
        measure: "energy",
        year: 2020,
    })!
}

function fixtureManifest(flowStages: FlowStage[]): FoodSupplyChainManifest {
    return {
        flowStages,
        totalStage: { key: "food", name: "Food available to eat" },
        units: { energy: "kcal", protein: "g", mass: "kg" },
        sources: [],
        method: "",
        entities: [],
        entityBySlug: new Map(),
        entityByName: new Map(),
    }
}

function fixtureEntityData(
    years: number[],
    values: Record<StageKey, number[]>
): EntityData {
    return {
        years,
        values: { energy: values, protein: values, mass: values },
    }
}
