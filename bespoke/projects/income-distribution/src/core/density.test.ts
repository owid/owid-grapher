import * as R from "remeda"
import { describe, expect, it } from "vitest"

import {
    DENSITY_BINS,
    DENSITY_MAX_INCOME,
    DENSITY_MIN_INCOME,
    WORLD_ENTITY_NAME,
} from "./constants.js"
import {
    aggregateByRegion,
    computeCountrySeries,
    DENSITY_GRID,
    estimateLogDensity,
    shareBelowLine,
    shareBelowLineForEntities,
    stackSeries,
} from "./density.js"
import { syntheticAvgs, YEAR } from "./testFixtures.js"

/** Area under a density over the log2 axis */
const area = (density: number[]): number => R.sum(density) * DENSITY_GRID.step

describe("the density grid", () => {
    it("spans the configured incomes with log-spaced points", () => {
        const { incomes, log2Incomes, step } = DENSITY_GRID
        expect(incomes).toHaveLength(DENSITY_BINS)
        expect(incomes[0]).toBeCloseTo(DENSITY_MIN_INCOME)
        expect(incomes.at(-1)).toBeCloseTo(DENSITY_MAX_INCOME)
        expect(log2Incomes[1] - log2Incomes[0]).toBeCloseTo(step)
        expect(log2Incomes[100] - log2Incomes[99]).toBeCloseTo(step)
    })
})

describe(estimateLogDensity, () => {
    it("has an area of 1", () => {
        expect(area(estimateLogDensity(syntheticAvgs(5)))).toBeCloseTo(1, 6)
    })

    it("peaks at the median of a symmetric distribution", () => {
        const density = estimateLogDensity(syntheticAvgs(5))
        const peak = DENSITY_GRID.incomes[density.indexOf(Math.max(...density))]
        expect(peak).toBeGreaterThan(4.5)
        expect(peak).toBeLessThan(5.5)
    })

    it("keeps incomes beyond the grid at its edges instead of dropping them", () => {
        const density = estimateLogDensity([
            ...R.times(500, () => 0),
            ...R.times(500, () => 5000),
        ])
        expect(area(density)).toBeCloseTo(1, 6)
        expect(density[0]).toBeGreaterThan(0)
        expect(density.at(-1)).toBeGreaterThan(0)
        expect(density[DENSITY_BINS / 2]).toBe(0)
    })
})

describe(computeCountrySeries, () => {
    it("stacks the last region of REGIONS first, then by population", () => {
        // Sub-Saharan Africa comes after South Asia in REGIONS
        expect(computeCountrySeries(YEAR).map((s) => s.key)).toEqual([
            "Poorland",
            "Richland",
            "Middleland",
        ])
    })
})

describe(aggregateByRegion, () => {
    const regions = aggregateByRegion(computeCountrySeries(YEAR))

    it("merges each region's countries, keeping the stacking order", () => {
        expect(regions.map((s) => [s.key, s.population])).toEqual([
            ["Sub-Saharan Africa", 150],
            ["South Asia", 300],
        ])
    })

    it("weights the merged density by population and keeps an area of 1", () => {
        const [poorland, richland] = computeCountrySeries(YEAR)
        const [africa] = regions
        const i = 120
        expect(africa.density[i]).toBeCloseTo(
            (100 * poorland.density[i] + 50 * richland.density[i]) / 150
        )
        expect(area(africa.density)).toBeCloseTo(1, 6)
    })
})

describe(stackSeries, () => {
    const stack = stackSeries(computeCountrySeries(YEAR))

    it("starts at zero and puts each series on top of the previous one", () => {
        expect(stack[0].y0.every((y) => y === 0)).toBe(true)
        expect(stack[1].y0).toEqual(stack[0].y1)
        expect(stack[2].y0).toEqual(stack[1].y1)
    })

    it("scales each band by its population", () => {
        const i = 100
        const { y0, y1, density, population } = stack[2]
        expect(y1[i] - y0[i]).toBeCloseTo(density[i] * population)
    })
})

describe(shareBelowLine, () => {
    const poorland = YEAR.byName.get("Poorland")!

    it("counts the bins strictly below the line", () => {
        expect(shareBelowLine(poorland, poorland.avgs[250])).toBe(0.25)
        expect(shareBelowLine(poorland, poorland.avgs[250] + 1e-9)).toBe(0.251)
    })

    it("covers everyone or no one at the extremes", () => {
        expect(shareBelowLine(poorland, 0)).toBe(0)
        expect(shareBelowLine(poorland, 1e9)).toBe(1)
    })
})

describe(shareBelowLineForEntities, () => {
    // Half of every country lives below its median
    const line = 5
    const middleland = YEAR.byName.get("Middleland")!
    const poorland = YEAR.byName.get("Poorland")!
    const richland = YEAR.byName.get("Richland")!

    it("weights regions and the world by population", () => {
        const shares = shareBelowLineForEntities(YEAR, line, [
            "Middleland",
            "Sub-Saharan Africa",
            WORLD_ENTITY_NAME,
        ])
        const poor = shareBelowLine(poorland, line)
        const rich = shareBelowLine(richland, line)
        const middle = shareBelowLine(middleland, line)
        expect(shares.get("Middleland")).toBe(middle)
        expect(shares.get("Sub-Saharan Africa")).toBeCloseTo(
            (100 * poor + 50 * rich) / 150
        )
        expect(shares.get(WORLD_ENTITY_NAME)).toBeCloseTo(
            (100 * poor + 50 * rich + 300 * middle) / 450
        )
    })

    it("leaves out entities it doesn't know, including empty regions", () => {
        const shares = shareBelowLineForEntities(YEAR, line, [
            "Atlantis",
            "North America",
        ])
        expect(shares.size).toBe(0)
    })
})
