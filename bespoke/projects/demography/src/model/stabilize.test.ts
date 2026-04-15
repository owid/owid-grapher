import { describe, it, expect } from "vitest"
import {
    MAX_AGE,
    CONTROL_YEARS,
    HISTORICAL_END_YEAR,
    END_YEAR,
} from "../helpers/constants"
import type { PopulationBySex } from "../helpers/types"
import { stabilizeParameter, computeTrajectoryError } from "./stabilize"
import {
    calculateLifeExpectancy,
    calculateTFR,
    type BaselineParams,
} from "./model"
import { runProjectionTrajectory } from "./projectionRunner"
import type { ScenarioParams } from "./scenarios"

// -- Fixture helpers --

function makePopulation(perAge: number): PopulationBySex {
    return {
        female: new Array(MAX_AGE + 1).fill(perAge),
        male: new Array(MAX_AGE + 1).fill(perAge),
    }
}

function makeGompertzMortality(): {
    female: number[]
    male: number[]
} {
    const rates = (sex: string): number[] => {
        const r = new Array(MAX_AGE + 1).fill(0)
        const sexFactor = sex === "male" ? 1.1 : 1.0
        for (let age = 0; age <= MAX_AGE; age++) {
            r[age] = Math.min(0.999, 0.001 * sexFactor * Math.exp(0.07 * age))
        }
        return r
    }
    return { female: rates("female"), male: rates("male") }
}

function makeFertility(peakRate = 60): number[] {
    const rates = new Array(MAX_AGE + 1).fill(0)
    for (let age = 15; age <= 49; age++) {
        if (age >= 20 && age <= 34) {
            rates[age] = peakRate
        } else {
            rates[age] = peakRate * 0.3
        }
    }
    return rates
}

function makeBaselineParams(
    overrides: Partial<BaselineParams> = {}
): BaselineParams {
    const fertility = overrides.fertility ?? makeFertility()
    const mortality = overrides.mortality ?? makeGompertzMortality()
    const avgMortality = mortality.female.map(
        (f, i) => (f + mortality.male[i]) / 2
    )
    return {
        fertility,
        mortality,
        migrationRate: overrides.migrationRate ?? 0,
        tfr: overrides.tfr ?? calculateTFR(fertility),
        lifeExpectancy:
            overrides.lifeExpectancy ?? calculateLifeExpectancy(avgMortality),
    }
}

function makeScenarioParams(
    overrides: Partial<ScenarioParams> = {}
): ScenarioParams {
    const baseline = makeBaselineParams()
    return {
        fertilityRate: overrides.fertilityRate ?? {
            [CONTROL_YEARS[0]]: baseline.tfr,
            [CONTROL_YEARS[1]]: baseline.tfr,
            [CONTROL_YEARS[2]]: baseline.tfr,
        },
        lifeExpectancy: overrides.lifeExpectancy ?? {
            [CONTROL_YEARS[0]]: baseline.lifeExpectancy,
            [CONTROL_YEARS[1]]: baseline.lifeExpectancy,
            [CONTROL_YEARS[2]]: baseline.lifeExpectancy,
        },
        netMigrationRate: overrides.netMigrationRate ?? {
            [CONTROL_YEARS[0]]: 0,
            [CONTROL_YEARS[1]]: 0,
            [CONTROL_YEARS[2]]: 0,
        },
    }
}

// -- Tests --

describe(computeTrajectoryError, () => {
    it("returns 0 when trajectory exactly matches targetPop at all years", () => {
        const trajectory: Record<number, number> = {}
        for (let year = HISTORICAL_END_YEAR + 1; year <= END_YEAR; year++) {
            trajectory[year] = 1000000
        }
        const error = computeTrajectoryError(trajectory, 1000000, 2050)
        expect(error).toBeCloseTo(0, 5)
    })

    it("returns positive error when trajectory deviates from target", () => {
        const trajectory: Record<number, number> = {}
        for (let year = HISTORICAL_END_YEAR + 1; year <= END_YEAR; year++) {
            trajectory[year] = 1100000 // 10% above target
        }
        const error = computeTrajectoryError(trajectory, 1000000, 2050)
        expect(error).toBeGreaterThan(0)
    })

    it("weights years after controlYear more heavily", () => {
        // Create two trajectories: one deviates before controlYear, one after
        const trajectoryEarlyDeviation: Record<number, number> = {}
        const trajectoryLateDeviation: Record<number, number> = {}

        for (let year = HISTORICAL_END_YEAR + 1; year <= END_YEAR; year++) {
            trajectoryEarlyDeviation[year] = year < 2050 ? 1200000 : 1000000
            trajectoryLateDeviation[year] = year >= 2050 ? 1200000 : 1000000
        }

        const earlyError = computeTrajectoryError(
            trajectoryEarlyDeviation,
            1000000,
            2050
        )
        const lateError = computeTrajectoryError(
            trajectoryLateDeviation,
            1000000,
            2050
        )

        // Late deviation should produce higher error (2x weight after controlYear)
        expect(lateError).toBeGreaterThan(earlyError)
    })

    it("returns 0 for empty trajectory", () => {
        const error = computeTrajectoryError({}, 1000000, 2050)
        expect(error).toBe(0)
    })
})

describe(stabilizeParameter, () => {
    // Use smaller population to keep tests fast
    const startPopulation = makePopulation(100)

    describe("structural properties", () => {
        it("returns params with entries for all three parameter keys", () => {
            const baselineParams = makeBaselineParams()
            const scenarioParams = makeScenarioParams()

            const result = stabilizeParameter(
                "fertilityRate",
                scenarioParams,
                baselineParams,
                startPopulation
            )

            expect(result.params.fertilityRate).toBeDefined()
            expect(result.params.lifeExpectancy).toBeDefined()
            expect(result.params.netMigrationRate).toBeDefined()
        })

        it("keeps the first control point (2030) fixed at its original value", () => {
            const baselineParams = makeBaselineParams()
            const scenarioParams = makeScenarioParams()
            const originalValue = scenarioParams.fertilityRate[CONTROL_YEARS[0]]

            const result = stabilizeParameter(
                "fertilityRate",
                scenarioParams,
                baselineParams,
                startPopulation
            )

            expect(result.params.fertilityRate[CONTROL_YEARS[0]]).toBe(
                originalValue
            )
        })

        it("adjusts only the specified parameterKey, leaving others unchanged", () => {
            const baselineParams = makeBaselineParams()
            const scenarioParams = makeScenarioParams()

            const result = stabilizeParameter(
                "fertilityRate",
                scenarioParams,
                baselineParams,
                startPopulation
            )

            // lifeExpectancy and netMigrationRate should be unchanged
            for (const year of CONTROL_YEARS) {
                expect(result.params.lifeExpectancy[year]).toBe(
                    scenarioParams.lifeExpectancy[year]
                )
                expect(result.params.netMigrationRate[year]).toBe(
                    scenarioParams.netMigrationRate[year]
                )
            }
        })
    })

    describe("fertilityRate stabilization", () => {
        it("for a growing population, stabilized TFR should be at or below the high input TFR", () => {
            const baselineParams = makeBaselineParams()
            const highTFR = 4.0 // Well above replacement
            const scenarioParams = makeScenarioParams({
                fertilityRate: {
                    [CONTROL_YEARS[0]]: highTFR,
                    [CONTROL_YEARS[1]]: highTFR,
                    [CONTROL_YEARS[2]]: highTFR,
                },
            })

            const result = stabilizeParameter(
                "fertilityRate",
                scenarioParams,
                baselineParams,
                startPopulation
            )

            // At least one adjustable control point should be below the input
            const adjusted2050 = result.params.fertilityRate[CONTROL_YEARS[1]]
            const adjusted2100 = result.params.fertilityRate[CONTROL_YEARS[2]]
            expect(adjusted2050 <= highTFR || adjusted2100 <= highTFR).toBe(
                true
            )
        })

        it("result TFR values stay within bounds [0.5, 6.0]", () => {
            const baselineParams = makeBaselineParams()
            const scenarioParams = makeScenarioParams()

            const result = stabilizeParameter(
                "fertilityRate",
                scenarioParams,
                baselineParams,
                startPopulation
            )

            for (const year of CONTROL_YEARS) {
                expect(
                    result.params.fertilityRate[year]
                ).toBeGreaterThanOrEqual(0.5)
                expect(result.params.fertilityRate[year]).toBeLessThanOrEqual(
                    6.0
                )
            }
        })
    })

    describe("lifeExpectancy stabilization", () => {
        it("result LE values stay within bounds [40, 130]", () => {
            const baselineParams = makeBaselineParams()
            const scenarioParams = makeScenarioParams()

            const result = stabilizeParameter(
                "lifeExpectancy",
                scenarioParams,
                baselineParams,
                startPopulation
            )

            for (const year of CONTROL_YEARS) {
                expect(
                    result.params.lifeExpectancy[year]
                ).toBeGreaterThanOrEqual(40)
                expect(result.params.lifeExpectancy[year]).toBeLessThanOrEqual(
                    130
                )
            }
        })
    })

    describe("netMigrationRate stabilization", () => {
        it("result migration values stay within bounds [-30, 50]", () => {
            const baselineParams = makeBaselineParams()
            const scenarioParams = makeScenarioParams()

            const result = stabilizeParameter(
                "netMigrationRate",
                scenarioParams,
                baselineParams,
                startPopulation
            )

            for (const year of CONTROL_YEARS) {
                expect(
                    result.params.netMigrationRate[year]
                ).toBeGreaterThanOrEqual(-30)
                expect(
                    result.params.netMigrationRate[year]
                ).toBeLessThanOrEqual(50)
            }
        })
    })

    describe("convergence", () => {
        it("running a projection with stabilized fertility params produces roughly constant population", () => {
            const baselineParams = makeBaselineParams()
            // Start with a growing scenario (high fertility)
            const scenarioParams = makeScenarioParams({
                fertilityRate: {
                    [CONTROL_YEARS[0]]: 3.0,
                    [CONTROL_YEARS[1]]: 3.0,
                    [CONTROL_YEARS[2]]: 3.0,
                },
            })

            const result = stabilizeParameter(
                "fertilityRate",
                scenarioParams,
                baselineParams,
                startPopulation
            )

            // Run projection with stabilized params
            const trajectory = runProjectionTrajectory({
                startPopulation,
                baselineParams,
                scenarioParams: result.params,
                historicalEndYear: HISTORICAL_END_YEAR,
                endYear: END_YEAR,
                controlYears: CONTROL_YEARS,
            })

            const startPop = trajectory[HISTORICAL_END_YEAR]
            const endPop = trajectory[END_YEAR]

            // Population should be roughly constant (within 15% -- the optimizer is approximate
            // and works with small populations which amplify rounding effects)
            const changePercent = Math.abs(endPop - startPop) / startPop
            expect(changePercent).toBeLessThan(0.15)
        })
    })
})
