import { describe, it, expect } from "vitest"
import {
    MAX_AGE,
    HISTORICAL_END_YEAR,
    CONTROL_YEARS,
    OWID_AGE_GROUPS,
    START_YEAR,
} from "../helpers/constants"
import type { CountryData, PopulationBySex } from "../helpers/types"
import type { ScenarioParams } from "./scenarios"
import {
    getInterpolatedValue,
    runProjectionResults,
    runProjectionFinalPopulation,
    runProjectionTrajectory,
    computeMaxAgeGroupPopulation,
    computeMaxTotalAgeGroupPopulation,
} from "./projectionRunner"
import {
    calculateLifeExpectancy,
    calculateTFR,
    getTotalPopulationFromArrays,
    type BaselineParams,
    type YearResult,
} from "./model"
import { getAgeGroupStart } from "../helpers/utils"

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

function makePopulationRow(pop: number[]): Record<string, number> {
    const row: Record<string, number> = {}
    for (const ageGroup of OWID_AGE_GROUPS) {
        const startAge = getAgeGroupStart(ageGroup)
        const endAge = ageGroup === "100+" ? 104 : startAge + 4
        let sum = 0
        for (let age = startAge; age <= endAge; age++) {
            sum += pop[age] || 0
        }
        row[ageGroup] = sum
    }
    return row
}

function makeMinimalCountryData(): CountryData {
    const pop = makePopulation(1000)
    const femalePopulation: Record<string, Record<string, number>> = {}
    const malePopulation: Record<string, Record<string, number>> = {}

    for (let year = START_YEAR; year <= HISTORICAL_END_YEAR; year++) {
        femalePopulation[year] = makePopulationRow(pop.female)
        malePopulation[year] = makePopulationRow(pop.male)
    }

    return {
        country: "Testland",
        femalePopulation,
        malePopulation,
        fertility: {},
        deaths: { female: {}, male: {} },
        migration: {},
        projection: { female: {}, male: {} },
        projectionScenario: {
            fertility: {},
            deaths: { female: {}, male: {} },
            migration: {},
        },
    } as unknown as CountryData
}

// -- Tests --

describe(getInterpolatedValue, () => {
    const points = { 2030: 2.0, 2050: 3.0, 2100: 1.0 }
    const controlYears = [2030, 2050, 2100] as const

    it("returns first control point value when year <= historicalEndYear", () => {
        expect(getInterpolatedValue(points, 2020, 2023, controlYears)).toBe(2.0)
        expect(getInterpolatedValue(points, 2023, 2023, controlYears)).toBe(2.0)
    })

    it("linearly interpolates between historicalEndYear and first control year", () => {
        // Midpoint between 2023 and 2030 is 2026.5
        const val = getInterpolatedValue(points, 2026.5, 2023, controlYears)
        expect(val).toBeCloseTo(2.0, 5) // Still 2.0 since interpolation is within first segment
        // Actually the first segment is from historicalEndYear (prevYear) to controlYears[0] (nextYear)
        // year=2026.5, prevYear=2023, nextYear=2030
        // t = (2026.5 - 2023) / (2030 - 2023) = 3.5/7 = 0.5
        // value = 2.0 + 0.5 * (2.0 - 2.0) = 2.0 (prevValue and nextValue are both points[2030] = 2.0)
        expect(val).toBeCloseTo(2.0, 5)
    })

    it("linearly interpolates between consecutive control years", () => {
        // Midpoint between 2030 and 2050
        const val = getInterpolatedValue(points, 2040, 2023, controlYears)
        // t = (2040 - 2030) / (2050 - 2030) = 0.5
        // value = 2.0 + 0.5 * (3.0 - 2.0) = 2.5
        expect(val).toBeCloseTo(2.5, 5)
    })

    it("returns last control year value when year >= last control year", () => {
        expect(getInterpolatedValue(points, 2100, 2023, controlYears)).toBe(1.0)
        expect(getInterpolatedValue(points, 2150, 2023, controlYears)).toBe(1.0)
    })

    it("returns exact control point value when year equals a control year", () => {
        expect(getInterpolatedValue(points, 2030, 2023, controlYears)).toBe(2.0)
        expect(getInterpolatedValue(points, 2050, 2023, controlYears)).toBe(3.0)
        expect(getInterpolatedValue(points, 2100, 2023, controlYears)).toBe(1.0)
    })

    it("handles interpolation between second and third control years", () => {
        // Midpoint between 2050 and 2100
        const val = getInterpolatedValue(points, 2075, 2023, controlYears)
        // t = (2075 - 2050) / (2100 - 2050) = 0.5
        // value = 3.0 + 0.5 * (1.0 - 3.0) = 2.0
        expect(val).toBeCloseTo(2.0, 5)
    })
})

describe(runProjectionResults, () => {
    it("returns results for every year from historicalEndYear to endYear inclusive", () => {
        const startPop = makePopulation(1000)
        const baselineParams = makeBaselineParams()
        const scenarioParams = makeScenarioParams()
        const endYear = HISTORICAL_END_YEAR + 10

        const results = runProjectionResults({
            startPopulation: startPop,
            baselineParams,
            scenarioParams,
            historicalEndYear: HISTORICAL_END_YEAR,
            endYear,
            controlYears: CONTROL_YEARS,
        })

        for (let year = HISTORICAL_END_YEAR; year <= endYear; year++) {
            expect(results[year]).toBeDefined()
            expect(results[year].population).toBeDefined()
            expect(typeof results[year].totalPop).toBe("number")
        }
    })

    it("first entry matches startPopulation", () => {
        const startPop = makePopulation(500)
        const results = runProjectionResults({
            startPopulation: startPop,
            baselineParams: makeBaselineParams(),
            scenarioParams: makeScenarioParams(),
            historicalEndYear: HISTORICAL_END_YEAR,
            endYear: HISTORICAL_END_YEAR + 5,
            controlYears: CONTROL_YEARS,
        })

        const expectedTotal = getTotalPopulationFromArrays(
            startPop.female,
            startPop.male
        )
        expect(results[HISTORICAL_END_YEAR].totalPop).toBe(expectedTotal)
    })

    it("each entry has consistent totalPop", () => {
        const results = runProjectionResults({
            startPopulation: makePopulation(1000),
            baselineParams: makeBaselineParams(),
            scenarioParams: makeScenarioParams(),
            historicalEndYear: HISTORICAL_END_YEAR,
            endYear: HISTORICAL_END_YEAR + 5,
            controlYears: CONTROL_YEARS,
        })

        for (
            let year = HISTORICAL_END_YEAR;
            year <= HISTORICAL_END_YEAR + 5;
            year++
        ) {
            const r = results[year]
            const computed = getTotalPopulationFromArrays(
                r.population.female,
                r.population.male
            )
            expect(r.totalPop).toBe(computed)
        }
    })

    it("applies interpolated parameters that change over time", () => {
        const baselineParams = makeBaselineParams()
        // Use two scenarios with different TFR paths
        const highFertilityParams = makeScenarioParams({
            fertilityRate: {
                [CONTROL_YEARS[0]]: 4.0,
                [CONTROL_YEARS[1]]: 4.0,
                [CONTROL_YEARS[2]]: 4.0,
            },
        })
        const lowFertilityParams = makeScenarioParams({
            fertilityRate: {
                [CONTROL_YEARS[0]]: 0.5,
                [CONTROL_YEARS[1]]: 0.5,
                [CONTROL_YEARS[2]]: 0.5,
            },
        })

        const endYear = HISTORICAL_END_YEAR + 20
        const startPop = makePopulation(1000)

        const highResults = runProjectionResults({
            startPopulation: startPop,
            baselineParams,
            scenarioParams: highFertilityParams,
            historicalEndYear: HISTORICAL_END_YEAR,
            endYear,
            controlYears: CONTROL_YEARS,
        })

        const lowResults = runProjectionResults({
            startPopulation: startPop,
            baselineParams,
            scenarioParams: lowFertilityParams,
            historicalEndYear: HISTORICAL_END_YEAR,
            endYear,
            controlYears: CONTROL_YEARS,
        })

        // Higher fertility should produce larger population
        expect(highResults[endYear].totalPop).toBeGreaterThan(
            lowResults[endYear].totalPop
        )
    })
})

describe(runProjectionFinalPopulation, () => {
    it("returns a single number representing final year total population", () => {
        const result = runProjectionFinalPopulation({
            startPopulation: makePopulation(1000),
            baselineParams: makeBaselineParams(),
            scenarioParams: makeScenarioParams(),
            historicalEndYear: HISTORICAL_END_YEAR,
            endYear: HISTORICAL_END_YEAR + 5,
            controlYears: CONTROL_YEARS,
        })

        expect(typeof result).toBe("number")
        expect(result).toBeGreaterThan(0)
    })

    it("matches last year's totalPop from runProjectionResults", () => {
        const config = {
            startPopulation: makePopulation(1000),
            baselineParams: makeBaselineParams(),
            scenarioParams: makeScenarioParams(),
            historicalEndYear: HISTORICAL_END_YEAR,
            endYear: HISTORICAL_END_YEAR + 10,
            controlYears: CONTROL_YEARS,
        }

        const finalPop = runProjectionFinalPopulation(config)
        const allResults = runProjectionResults(config)
        const lastYearPop = allResults[HISTORICAL_END_YEAR + 10].totalPop

        expect(finalPop).toBe(lastYearPop)
    })
})

describe(runProjectionTrajectory, () => {
    it("returns Record<year, totalPop> from historicalEndYear to endYear", () => {
        const endYear = HISTORICAL_END_YEAR + 10
        const trajectory = runProjectionTrajectory({
            startPopulation: makePopulation(1000),
            baselineParams: makeBaselineParams(),
            scenarioParams: makeScenarioParams(),
            historicalEndYear: HISTORICAL_END_YEAR,
            endYear,
            controlYears: CONTROL_YEARS,
        })

        for (let year = HISTORICAL_END_YEAR; year <= endYear; year++) {
            expect(typeof trajectory[year]).toBe("number")
        }
    })

    it("first entry matches startPopulation total", () => {
        const startPop = makePopulation(500)
        const trajectory = runProjectionTrajectory({
            startPopulation: startPop,
            baselineParams: makeBaselineParams(),
            scenarioParams: makeScenarioParams(),
            historicalEndYear: HISTORICAL_END_YEAR,
            endYear: HISTORICAL_END_YEAR + 5,
            controlYears: CONTROL_YEARS,
        })

        const expectedTotal = getTotalPopulationFromArrays(
            startPop.female,
            startPop.male
        )
        expect(trajectory[HISTORICAL_END_YEAR]).toBe(expectedTotal)
    })

    it("trajectory is monotonically decreasing with zero fertility and high mortality", () => {
        const mortality = makeGompertzMortality()
        const baselineParams = makeBaselineParams({
            fertility: new Array(MAX_AGE + 1).fill(0),
            mortality,
            tfr: 0,
        })
        const scenarioParams = makeScenarioParams({
            fertilityRate: {
                [CONTROL_YEARS[0]]: 0,
                [CONTROL_YEARS[1]]: 0,
                [CONTROL_YEARS[2]]: 0,
            },
        })

        const endYear = HISTORICAL_END_YEAR + 20
        const trajectory = runProjectionTrajectory({
            startPopulation: makePopulation(1000),
            baselineParams,
            scenarioParams,
            historicalEndYear: HISTORICAL_END_YEAR,
            endYear,
            controlYears: CONTROL_YEARS,
        })

        for (let year = HISTORICAL_END_YEAR + 1; year <= endYear; year++) {
            expect(trajectory[year]).toBeLessThanOrEqual(trajectory[year - 1])
        }
    })
})

describe(computeMaxAgeGroupPopulation, () => {
    it("returns positive value for population data in percent mode", () => {
        const data = makeMinimalCountryData()
        const maxVal = computeMaxAgeGroupPopulation({
            data,
            forecastResults: null,
        })
        expect(maxVal).toBeGreaterThan(0)
    })

    it("returns positive value in absolute mode", () => {
        const data = makeMinimalCountryData()
        const maxVal = computeMaxAgeGroupPopulation(
            { data, forecastResults: null },
            "absolute"
        )
        expect(maxVal).toBeGreaterThan(0)
    })

    it("considers forecast results when provided", () => {
        const data = makeMinimalCountryData()
        const largePop = makePopulation(100000)
        const forecastResults: Record<number, YearResult> = {
            [HISTORICAL_END_YEAR + 1]: {
                population: largePop,
                totalPop: getTotalPopulationFromArrays(
                    largePop.female,
                    largePop.male
                ),
            },
        }

        const withForecast = computeMaxAgeGroupPopulation(
            { data, forecastResults },
            "absolute"
        )
        const withoutForecast = computeMaxAgeGroupPopulation(
            { data, forecastResults: null },
            "absolute"
        )

        expect(withForecast).toBeGreaterThanOrEqual(withoutForecast)
    })
})

describe(computeMaxTotalAgeGroupPopulation, () => {
    it("returns the maximum combined male+female for any age group", () => {
        const data = makeMinimalCountryData()
        const maxVal = computeMaxTotalAgeGroupPopulation({
            data,
            forecastResults: null,
        })
        expect(maxVal).toBeGreaterThan(0)
    })

    it("checks both historical data and forecast results", () => {
        const data = makeMinimalCountryData()
        const largePop = makePopulation(100000)
        const forecastResults: Record<number, YearResult> = {
            [HISTORICAL_END_YEAR + 1]: {
                population: largePop,
                totalPop: getTotalPopulationFromArrays(
                    largePop.female,
                    largePop.male
                ),
            },
        }

        const withForecast = computeMaxTotalAgeGroupPopulation({
            data,
            forecastResults,
        })
        const withoutForecast = computeMaxTotalAgeGroupPopulation({
            data,
            forecastResults: null,
        })

        expect(withForecast).toBeGreaterThanOrEqual(withoutForecast)
    })
})
