import { describe, expect, it } from "vitest"

import { findIndicatorIds, joinIndicators, MultidimConfig } from "./data.js"
import { parseFlopBound } from "./config.js"
import { getTimeDomain } from "./timeDomain.js"
import { getYAxis } from "./yAxis.js"
import { getColor } from "./colorSchemes.js"
import { AiModel } from "./constants.js"

describe(findIndicatorIds, () => {
    const view = (color: string, y: number, colorId: number) => ({
        dimensions: { metric: "compute", color },
        indicators: { y: [{ id: y }], color: { id: colorId } },
    })

    it("reads the compute and color indicators from the multidim's views", () => {
        const config: MultidimConfig = {
            views: [
                view("country", 10, 13),
                view("reporting", 10, 11),
                view("developer", 10, 12),
                {
                    dimensions: { metric: "parameters", color: "reporting" },
                    indicators: { y: [{ id: 99 }], color: { id: 11 } },
                },
            ],
        }
        expect(findIndicatorIds(config)).toEqual({
            compute: 10,
            color: { reporting: 11, developer: 12 },
        })
    })

    it("fails loudly when a view it needs is gone", () => {
        expect(() =>
            findIndicatorIds({ views: [view("reporting", 10, 11)] })
        ).toThrow()
    })
})

describe(joinIndicators, () => {
    const computeMetadata = {
        display: { zeroDay: "1949-01-01" },
        dimensions: {
            entities: {
                values: [
                    { id: 1, name: "Model A" },
                    { id: 2, name: "Model B" },
                ],
            },
        },
    }

    it("joins the color indicators to each model by entity and day", () => {
        const models = joinIndicators({
            // Model B has two releases on different days
            compute: {
                entities: [1, 2, 2],
                years: [0, 365, 730],
                values: [1e20, 2e24, 3e25],
            },
            computeMetadata,
            reporting: {
                entities: [1, 2, 2],
                years: [0, 365, 730],
                values: [
                    "Estimated by Epoch AI",
                    "Reported by the developer",
                    "Estimated by Epoch AI",
                ],
            },
            // The developer indicator also covers models without compute
            developer: {
                entities: [1, 2, 2, 3],
                years: [0, 365, 730, 0],
                values: ["Other", "Google", "Google", "Meta"],
            },
            confidenceByModel: new Map([["Model B", "Likely"]]),
        })
        expect(
            models.map((m) => [m.model, m.trainingComputeFlop, m.reporting])
        ).toEqual([
            ["Model A", 1e20, "Estimated by Epoch AI"],
            ["Model B", 2e24, "Reported by the developer"],
            ["Model B", 3e25, "Estimated by Epoch AI"],
        ])
        expect(models[0].date.toISOString()).toBe("1949-01-01T00:00:00.000Z")
        expect(models[1].developer).toBe("Google")
        expect(models[1].confidence).toBe("Likely")
        expect(models[0].confidence).toBeUndefined()
    })

    it("skips values that aren't a positive number of FLOP", () => {
        const models = joinIndicators({
            compute: { entities: [1, 2], years: [0, 0], values: [0, "n/a"] },
            computeMetadata,
            reporting: { entities: [], years: [], values: [] },
            developer: { entities: [], years: [], values: [] },
            confidenceByModel: new Map(),
        })
        expect(models).toEqual([])
    })
})

describe(parseFlopBound, () => {
    it.each([
        ["1e24", 1e24],
        // "10e24" is 10 × 10²⁴, as in code
        ["10e24", 1e25],
        ["10^24", 1e24],
        ["10²⁴", 1e24],
        ["3 × 10^24", 3e24],
        ["3x10²⁶", 3e26],
        ["1,000,000", 1e6],
    ])("%s → %d", (input, expected) => {
        expect(parseFlopBound(input)).toBe(expected)
    })

    it("rejects anything that isn't a positive number", () => {
        expect(() => parseFlopBound("a lot")).toThrow()
        expect(() => parseFlopBound("0")).toThrow()
        expect(() => parseFlopBound("-1e24")).toThrow()
    })
})

const model = (year: number, flop = 1e24): AiModel => ({
    model: `Model ${year}`,
    date: new Date(Date.UTC(Math.floor(year), 0, 1)),
    year,
    trainingComputeFlop: flop,
    developer: "Google",
    reporting: "Estimated by Epoch AI",
})

describe(getTimeDomain, () => {
    const models = [model(1950.5), model(2026.7)]

    it("spans whole years from the earliest model to the latest", () => {
        expect(getTimeDomain(models, {})).toEqual([1950, 2027])
    })

    it("includes the configured end year in full", () => {
        expect(
            getTimeDomain(models, { startYear: 2010, endYear: 2020 })
        ).toEqual([2010, 2021])
    })
})

describe(getYAxis, () => {
    it("fits a log axis to the data and labels every thousandfold step", () => {
        const axis = getYAxis({
            values: [40, 9.4e26],
            yScaleType: "log",
            yBounds: {},
            isNarrow: false,
        })
        expect(axis.domain[0]).toBe(1)
        expect(axis.ticksFor(500).map((t) => Math.log10(t.value))).toEqual([
            0, 3, 6, 9, 12, 15, 18, 21, 24, 27,
        ])
        expect(axis.linesFor(1e6)).toEqual(["1 million (10⁶)"])
    })

    it("takes configured bounds over the data's", () => {
        const axis = getYAxis({
            values: [40, 9.4e26],
            yScaleType: "log",
            yBounds: { min: 1e18, max: 1e27 },
            isNarrow: false,
        })
        expect(axis.domain).toEqual([1e18, 1e27])
        expect(axis.gridValues(500)).toEqual([1e18, 1e21, 1e24, 1e27])
    })

    it("starts a linear axis at zero with round ticks", () => {
        const axis = getYAxis({
            values: [1e20, 9.4e26],
            yScaleType: "linear",
            yBounds: {},
            isNarrow: false,
        })
        expect(axis.domain[0]).toBe(0)
        expect(axis.domain[1]).toBeGreaterThanOrEqual(9.4e26)
        expect(axis.ticksFor(500)[0].lines).toEqual(["0"])
    })
})

describe(getColor, () => {
    it("uses the multidim's colors for each group", () => {
        expect(getColor("developer", model(2020))).toBe("#4285F4")
        expect(getColor("reporting", model(2020))).toBe("#996D36")
    })
})
