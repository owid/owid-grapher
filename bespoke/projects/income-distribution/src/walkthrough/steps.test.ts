import { describe, expect, it } from "vitest"

import { parseIncomeDistributionYear } from "../core/data.js"
import { syntheticAvgs } from "../core/testFixtures.js"
import { REGIONS, type RawIncomeDistributionYear } from "../core/types.js"
import type { Scene } from "./scene.js"
import { buildSteps, initialScene, StepScenes } from "./steps.js"
import { buildWalkthroughData } from "./walkthroughData.js"

/** A made-up world with the countries the walkthrough names, and one country in every region */
function makeYear(): RawIncomeDistributionYear {
    const countries: [string, string, number, number][] = [
        ["Nigeria", "Sub-Saharan Africa", 230, 1.5],
        ["Democratic Republic of Congo", "Sub-Saharan Africa", 110, 1],
        ["United States", "North America", 340, 70],
        ["India", "South Asia", 1450, 4],
        ["Brazil", "Latin America and Caribbean", 210, 12],
        ...REGIONS.map((region, i): [string, string, number, number] => [
            `Country ${i}`,
            region,
            100,
            2 + i * 5,
        ]),
    ]
    return {
        year: 2025,
        data: Object.fromEntries(
            countries.map(([country, region, population, median]) => [
                country,
                {
                    country,
                    region,
                    totalPopulation: population * 1e6,
                    avgs: syntheticAvgs(median),
                },
            ])
        ),
    }
}

/**
 * What a scene draws: series and marks that can't be seen count as absent,
 * since a step may create one before it fades it in
 */
function visible(scene: Scene): unknown {
    return {
        // The y-axis has no ticks, so its scale only shows through what is drawn
        yMax: Object.keys(scene.series).length ? scene.yMax : 0,
        stack: scene.stack,
        unit: scene.unit,
        outline: scene.outline.alpha > 0.001 ? scene.outline : undefined,
        legendAlpha: scene.legendAlpha,
        series: Object.fromEntries(
            Object.entries(scene.series)
                .filter(([, s]) => s.alpha > 0.001 && s.reveal > 0)
                .map(([key, { density: _density, ...rest }]) => [key, rest])
        ),
        marks: Object.fromEntries(
            Object.entries(scene.marks).filter(([, m]) => m.alpha > 0.001)
        ),
    }
}

describe("the walkthrough's steps", () => {
    const data = buildWalkthroughData(parseIncomeDistributionYear(makeYear()))
    const scenes = new StepScenes(initialScene(data), buildSteps(data))

    // Scrolling forward plays a step from its start; scrolling back lands
    // on the previous step's end. Both have to be the same picture.
    it.each(scenes.steps.map((_, i) => i))(
        "step %i starts where the one before it ends",
        (i) => {
            expect(visible(scenes.at(i, 0))).toEqual(visible(scenes.startOf(i)))
        }
    )

    // A fade that outlasts its step's duration would leave a mark half-drawn
    it("finishes every fade before its step ends", () => {
        scenes.steps.forEach((_, i) => {
            const end = scenes.endOf(i)
            for (const mark of Object.values(end.marks))
                expect(mark.alpha).toBeCloseTo(1)
            for (const series of Object.values(end.series))
                expect(series.reveal).toBe(1)
        })
    })

    it("ends on the world's distribution, focused below $30 a day", () => {
        const last = scenes.endOf(scenes.steps.length - 1)
        expect(last.stack).toBe(1)
        expect(last.unit).toBe(1)
        expect(Object.keys(last.series).sort()).toEqual([...REGIONS].sort())
        for (const s of Object.values(last.series))
            expect(2 ** s.focusHi).toBeCloseTo(30)
    })
})
