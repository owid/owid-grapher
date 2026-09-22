import { describe, expect, it } from "vitest"

import {
    EntityData,
    FlowStage,
    FoodSupplyChainManifest,
    StageKey,
} from "./types.js"
import { buildWaterfall } from "./waterfall.js"

describe(buildWaterfall, () => {
    it('computes a positive delta for an "out" stage with a negative value', () => {
        const manifest = fixtureManifest([
            { key: "exports", name: "Exports", direction: "out" },
        ])
        const entityData = fixtureEntityData([2020], {
            exports: [-10],
            food: [10],
        })
        const result = buildWaterfall({
            manifest,
            entityData,
            measure: "energy",
            year: 2020,
        })!
        expect(result.steps[0].delta).toBe(10)
    })

    it("chains each step's start to the previous end, starting at zero", () => {
        const manifest = fixtureManifest([
            { key: "crop", name: "Crop production", direction: "in" },
            { key: "exports", name: "Exports", direction: "out" },
        ])
        const entityData = fixtureEntityData([2020], {
            crop: [20],
            exports: [5],
            food: [15],
        })
        const result = buildWaterfall({
            manifest,
            entityData,
            measure: "energy",
            year: 2020,
        })!
        expect(result.steps[0].balanceBefore).toBe(0)
        expect(result.steps[1].balanceBefore).toBe(result.steps[0].balanceAfter)
    })

    it("closes the last step's end to the total's value", () => {
        const manifest = fixtureManifest([
            { key: "crop", name: "Crop production", direction: "in" },
            { key: "exports", name: "Exports", direction: "out" },
        ])
        const entityData = fixtureEntityData([2020], {
            crop: [20],
            exports: [5],
            food: [15],
        })
        const result = buildWaterfall({
            manifest,
            entityData,
            measure: "energy",
            year: 2020,
        })!
        expect(result.steps.at(-1)!.balanceAfter).toBeCloseTo(
            result.total.value
        )
    })

    it("extends the domain's lower bound below zero when the balance dips", () => {
        const manifest = fixtureManifest([
            { key: "crop", name: "Crop production", direction: "in" },
            { key: "exports", name: "Exports", direction: "out" },
        ])
        const entityData = fixtureEntityData([2020], {
            crop: [10],
            exports: [50],
            food: [-40],
        })
        const result = buildWaterfall({
            manifest,
            entityData,
            measure: "energy",
            year: 2020,
        })!
        expect(result.domain[0]).toBe(-40)
    })

    it("returns a domain lower bound of zero when the balance never dips", () => {
        const manifest = fixtureManifest([
            { key: "crop", name: "Crop production", direction: "in" },
            { key: "imports", name: "Imports", direction: "in" },
        ])
        const entityData = fixtureEntityData([2020], {
            crop: [10],
            imports: [5],
            food: [15],
        })
        const result = buildWaterfall({
            manifest,
            entityData,
            measure: "energy",
            year: 2020,
        })!
        expect(result.domain[0]).toBe(0)
    })
})

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
