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
    countStepAxisSlots,
    MIN_BAR_LENGTH_PX,
    layOutWaterfall,
    measureGroupHeaderSlots,
    PlacedRect,
    PlacedStep,
    WaterfallLayout,
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

    it("connects the steps to each other but not to the total", () => {
        const waterfall = fixtureWaterfall({
            crop: [100],
            exports: [10],
            tourism: [5],
            food: [85],
        })
        const layout = layOutWaterfall(waterfall, BOX)

        expect(
            layout.connectors.map((connector) => connector.leftStep.key)
        ).toEqual(["crop", "exports"])
    })

    it("connects the last drawn step to the total at the total's value", () => {
        const waterfall = fixtureWaterfall({
            crop: [100],
            exports: [10],
            tourism: [0],
            food: [90],
        })
        const layout = layOutWaterfall(waterfall, BOX, {
            orientation: "horizontal",
        })

        const exports = layout.steps.find((step) => step.step.key === "exports")
        const totalBar = layout.total.bar!
        expect(layout.totalConnector).toEqual({
            x1: layout.total.valueAnchor.x,
            y1: exports!.bar!.y + exports!.bar!.height,
            x2: layout.total.valueAnchor.x,
            y2: totalBar.y,
        })
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
    })

    it("spans each group's box over exactly its own columns", () => {
        const layout = layOutWaterfall(fixtureGroupedWaterfall(), BOX)

        expect(layout.groups.map((placed) => placed.group.key)).toEqual(
            STAGE_GROUPS.map((group) => group.key)
        )
        for (const placed of layout.groups) {
            expect(stepKeysInsideGroupBox(layout.steps, placed.box)).toEqual(
                placed.group.stageKeys
            )
            expect(stepKeysInsideGroupBox([layout.total], placed.box)).toEqual(
                []
            )
        }
    })

    it("runs each group's box the full height of the plot", () => {
        const layout = layOutWaterfall(fixtureGroupedWaterfall(), BOX)

        for (const placed of layout.groups) {
            expect(placed.box.y).toBeCloseTo(BOX.y)
            expect(placed.box.height).toBeCloseTo(BOX.height)
        }
    })

    it("drops a box whose stages are no longer side by side", () => {
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
            "turned_into_other_products"
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

describe("horizontal layout", () => {
    /** BOX turned on its side, so both layouts get the same pixels along each axis */
    const TRANSPOSED_BOX: Box = { x: 10, y: 20, width: 200, height: 300 }

    it("places the same bars as the vertical layout, transposed", () => {
        const waterfall = fixtureWaterfall({
            crop: [100],
            exports: [10],
            tourism: [5],
            food: [85],
        })
        const vertical = layOutWaterfall(waterfall, BOX)
        const horizontal = layOutWaterfall(waterfall, TRANSPOSED_BOX, {
            orientation: "horizontal",
        })

        const verticalSteps = [...vertical.steps, vertical.total]
        const horizontalSteps = [...horizontal.steps, horizontal.total]
        expect(horizontalSteps.map((step) => step.step.key)).toEqual(
            verticalSteps.map((step) => step.step.key)
        )
        verticalSteps.forEach((verticalStep, index) => {
            const verticalBar = verticalStep.bar!
            const horizontalBar = horizontalSteps[index].bar!
            // Values run up the vertical box and rightwards across the horizontal one
            expect(
                horizontalBar.x -
                    TRANSPOSED_BOX.x -
                    (BOX.y + BOX.height - verticalBar.y - verticalBar.height)
            ).toBeCloseTo(0, 6)
            expect(horizontalBar.width).toBeCloseTo(verticalBar.height, 6)
            expect(horizontalBar.y - TRANSPOSED_BOX.y).toBeCloseTo(
                verticalBar.x - BOX.x,
                6
            )
            expect(horizontalBar.height).toBeCloseTo(verticalBar.width, 6)
        })
    })

    it("runs its gridlines down the box, top to bottom", () => {
        const layout = layOutWaterfall(fixtureGroupedWaterfall(), BOX, {
            orientation: "horizontal",
        })

        for (const tick of layout.ticks) {
            expect(tick.gridline.x1).toBe(tick.gridline.x2)
            expect(tick.gridline.y1).toBeCloseTo(BOX.y)
            expect(tick.gridline.y2).toBeCloseTo(BOX.y + BOX.height)
        }
    })

    it("starts each group's box the header's height above its first row", () => {
        const waterfall = fixtureGroupedWaterfall()
        const headerHeightPx = 20
        const rowHeightPx = 30
        const groupHeaderSlots = measureGroupHeaderSlots(
            headerHeightPx,
            rowHeightPx
        )
        const box: Box = {
            x: 10,
            y: 20,
            width: 300,
            height:
                rowHeightPx *
                countStepAxisSlots(waterfall.steps, { groupHeaderSlots }),
        }
        const layout = layOutWaterfall(waterfall, box, {
            orientation: "horizontal",
            groupHeaderSlots,
        })

        expect(layout.groups).toHaveLength(STAGE_GROUPS.length)
        for (const placed of layout.groups) {
            const firstRow = findStep(layout.steps, placed.group.stageKeys[0])
            expect(firstRow.slot.height).toBeCloseTo(rowHeightPx)
            expect(firstRow.slot.y - placed.box.y).toBeCloseTo(headerHeightPx)
        }
    })

    it("widens the space between neighbouring boxes by the gap", () => {
        const waterfall = fixtureGroupedWaterfall()
        const boxGapSlots = 0.5
        const withoutGap = layOutWaterfall(waterfall, BOX, {
            orientation: "horizontal",
        })
        const box: Box = {
            ...BOX,
            height:
                (BOX.height *
                    countStepAxisSlots(waterfall.steps, { boxGapSlots })) /
                countStepAxisSlots(waterfall.steps, {}),
        }
        const withGap = layOutWaterfall(waterfall, box, {
            orientation: "horizontal",
            boxGapSlots,
        })

        const slotLengthPx = withoutGap.steps[0].slot.height
        const boxGaps = (layout: WaterfallLayout): number[] => {
            const boxes = [
                ...layout.groups.map((placed) => placed.box),
                layout.totalBox,
            ]
            return boxes
                .slice(1)
                .map((next, i) => next.y - (boxes[i].y + boxes[i].height))
        }
        boxGaps(withGap).forEach((gap, i) =>
            expect(gap - boxGaps(withoutGap)[i]).toBeCloseTo(
                boxGapSlots * slotLengthPx
            )
        )
    })

    it("keeps each group's rows, and only those, inside its box", () => {
        const layout = layOutWaterfall(fixtureGroupedWaterfall(), BOX, {
            orientation: "horizontal",
            groupHeaderSlots: 0.8,
        })

        for (const placed of layout.groups) {
            expect(stepKeysInsideRowsOf(layout.steps, placed.box)).toEqual(
                placed.group.stageKeys
            )
        }
    })
})

function findStep(steps: PlacedStep[], key: StageKey): PlacedStep {
    const step = steps.find((candidate) => candidate.step.key === key)
    if (!step) throw new Error(`No step ${key}`)
    return step
}

function stepKeysInsideRowsOf(
    steps: PlacedStep[],
    box: PlacedRect
): StageKey[] {
    return steps
        .filter(
            (step) =>
                step.valueAnchor.y > box.y &&
                step.valueAnchor.y < box.y + box.height
        )
        .map((step) => step.step.key)
}

function stepKeysInsideGroupBox(
    steps: PlacedStep[],
    box: { x: number; width: number }
): StageKey[] {
    return steps
        .filter(
            (step) =>
                step.valueAnchor.x > box.x &&
                step.valueAnchor.x < box.x + box.width
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
        values: { energy: values, protein: values },
    }
}
