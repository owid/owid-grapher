import { describe, expect, it } from "vitest"

import { YEAR } from "../core/testFixtures.js"
import { poolDistributions } from "./pooledDistribution.js"

// Poorland: 100 people, median $2; Richland: 50 people, median $40
const poorland = YEAR.byName.get("Poorland")!
const richland = YEAR.byName.get("Richland")!

describe(poolDistributions, () => {
    const pooled = poolDistributions([poorland, richland])

    it("counts everyone", () => {
        expect(pooled.population).toBeCloseTo(150)
        expect(pooled.below(Infinity)).toBeCloseTo(150)
        expect(pooled.below(0)).toBe(0)
    })

    it("weights each country's bins by its population", () => {
        // Half of Poorland and almost none of Richland live below $2
        expect(pooled.below(2)).toBeCloseTo(50, 0)
        // All of Poorland and half of Richland live below $40
        expect(pooled.below(40)).toBeCloseTo(125, 0)
    })

    it("finds the income below which a share of people live", () => {
        // A third of the people is half of Poorland
        expect(pooled.quantile(1 / 3)).toBeCloseTo(2, 0)
        expect(pooled.quantile(0)).toBe(poorland.avgs[0])
    })

    it("counts the people between two incomes", () => {
        expect(pooled.between(2, 40)).toBeCloseTo(
            pooled.below(40) - pooled.below(2)
        )
    })
})
