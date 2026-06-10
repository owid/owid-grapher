import { describe, it, expect } from "vitest"
import {
    MAX_AGE,
    OWID_AGE_GROUPS,
    FERTILITY_AGE_GROUPS,
    CONTROL_YEARS,
} from "../helpers/constants"
import type {
    CountryData,
    PopulationBySex,
    DeathsByAgeGroup,
    MortalityRates,
} from "../helpers/types"
import { getAgeGroupStart } from "../helpers/utils"
import {
    calculateTFRFromRaw,
    estimateLifeExpectancy,
    calculatePeriodAverages,
    calculateTrendProjections,
    calculateFullTrendScenario,
    calculateUNWPPScenario,
    type ScenarioConstants,
} from "./scenarios"
import { type YearResult } from "./model"

// -- Fixture helpers --

function makePopulation(perAge: number): PopulationBySex {
    return {
        female: new Array(MAX_AGE + 1).fill(perAge),
        male: new Array(MAX_AGE + 1).fill(perAge),
    }
}

function makeGompertzMortality(): MortalityRates {
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

function makeDeathsByAgeGroup(
    pop: PopulationBySex,
    mortality: MortalityRates
): DeathsByAgeGroup {
    const result: DeathsByAgeGroup = { female: {}, male: {} }
    for (const ageGroup of OWID_AGE_GROUPS) {
        const startAge = getAgeGroupStart(ageGroup)
        const endAge = ageGroup === "100+" ? 104 : startAge + 4
        let femaleDeaths = 0
        let maleDeaths = 0
        for (let age = startAge; age <= endAge; age++) {
            femaleDeaths +=
                (pop.female[age] || 0) * (mortality.female[age] || 0)
            maleDeaths += (pop.male[age] || 0) * (mortality.male[age] || 0)
        }
        result.female[ageGroup] = femaleDeaths
        result.male[ageGroup] = maleDeaths
    }
    return result
}

function makeFertilityRow(ratePerGroup: number): Record<string, number> {
    const row: Record<string, number> = {}
    for (const ag of FERTILITY_AGE_GROUPS) {
        row[ag] = ratePerGroup
    }
    return row
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

const TEST_CONSTANTS: ScenarioConstants = {
    HISTORICAL_END_YEAR: 2023,
    CONTROL_YEARS,
    TREND_EARLY_START: 2000,
    TREND_EARLY_END: 2003,
    TREND_LATE_START: 2020,
    TREND_LATE_END: 2023,
}

function makeTestCountryData(
    years: number[],
    options: {
        fertilityRatePerGroup?: number
        migrationRate?: number
        population?: PopulationBySex
        mortality?: MortalityRates
    } = {}
): CountryData {
    const pop = options.population ?? makePopulation(1000)
    const mortality = options.mortality ?? makeGompertzMortality()
    const fertilityRate = options.fertilityRatePerGroup ?? 40
    const migrationRate = options.migrationRate ?? 0

    const femalePopulation: Record<string, Record<string, number>> = {}
    const malePopulation: Record<string, Record<string, number>> = {}
    const fertilityData: Record<string, Record<string, number>> = {}
    const deaths: Record<string, Record<string, Record<string, number>>> = {
        female: {},
        male: {},
    }
    const migration: Record<string, { net_migration_rate: number }> = {}

    for (const year of years) {
        femalePopulation[year] = makePopulationRow(pop.female)
        malePopulation[year] = makePopulationRow(pop.male)
        fertilityData[year] = makeFertilityRow(fertilityRate)
        const deathsForYear = makeDeathsByAgeGroup(pop, mortality)
        deaths.female[year] = deathsForYear.female
        deaths.male[year] = deathsForYear.male
        migration[year] = { net_migration_rate: migrationRate }
    }

    return {
        country: "Testland",
        femalePopulation,
        malePopulation,
        fertility: fertilityData,
        deaths,
        migration,
        projection: { female: {}, male: {} },
        projectionScenario: {
            fertility: {},
            deaths: { female: {}, male: {} },
            migration: {},
        },
    } as unknown as CountryData
}

function makeBenchmarkResults(
    years: number[],
    pop: PopulationBySex
): Record<number, YearResult> {
    const results: Record<number, YearResult> = {}
    const totalPop =
        pop.female.reduce((a, b) => a + b, 0) +
        pop.male.reduce((a, b) => a + b, 0)
    for (const year of years) {
        results[year] = {
            population: { female: [...pop.female], male: [...pop.male] },
            totalPop,
        }
    }
    return results
}

// -- Tests --

describe(calculateTFRFromRaw, () => {
    it("returns null for undefined input", () => {
        expect(calculateTFRFromRaw(undefined)).toBeNull()
    })

    it("sums 5-year group values * 5 / 1000 to produce TFR", () => {
        // 9 fertility age groups, each with rate 40
        // TFR = 9 * 40 * 5 / 1000 = 1.8
        const row = makeFertilityRow(40)
        const tfr = calculateTFRFromRaw(row)
        expect(tfr).toBeCloseTo(1.8, 2)
    })

    it("returns 0 for all-zero fertility row", () => {
        const row = makeFertilityRow(0)
        expect(calculateTFRFromRaw(row)).toBeCloseTo(0, 10)
    })

    it("handles missing age groups by treating them as 0", () => {
        const row = { "20-24": 100 } // Only one group present
        const tfr = calculateTFRFromRaw(row)
        // TFR = 1 * 100 * 5 / 1000 = 0.5
        expect(tfr).toBeCloseTo(0.5, 2)
    })
})

describe(estimateLifeExpectancy, () => {
    it("computes reasonable LE for typical mortality patterns", () => {
        const pop = makePopulation(1000)
        const mortality = makeGompertzMortality()
        const deaths = makeDeathsByAgeGroup(pop, mortality)
        const le = estimateLifeExpectancy(deaths, pop.female, pop.male)
        expect(le).toBeGreaterThan(40)
        expect(le).toBeLessThan(100)
    })

    it("returns very low LE when mortality is very high", () => {
        const pop = makePopulation(1000)
        // Create high mortality: death count equals population (100% mortality)
        const highMortality: MortalityRates = {
            female: new Array(MAX_AGE + 1).fill(0.5),
            male: new Array(MAX_AGE + 1).fill(0.5),
        }
        const deaths = makeDeathsByAgeGroup(pop, highMortality)
        const le = estimateLifeExpectancy(deaths, pop.female, pop.male)
        expect(le).toBeLessThan(30)
    })

    it("handles zero population gracefully", () => {
        const zeroPop: PopulationBySex = {
            female: new Array(MAX_AGE + 1).fill(0),
            male: new Array(MAX_AGE + 1).fill(0),
        }
        const deaths: DeathsByAgeGroup = { female: {}, male: {} }
        // Should not throw
        const le = estimateLifeExpectancy(deaths, zeroPop.female, zeroPop.male)
        expect(Number.isFinite(le)).toBe(true)
    })
})

describe(calculatePeriodAverages, () => {
    it("averages TFR, LE, and migration rate over the given year range", () => {
        const years = [2020, 2021, 2022, 2023]
        const pop = makePopulation(1000)
        const data = makeTestCountryData(years, {
            fertilityRatePerGroup: 40,
            migrationRate: 5,
        })
        const benchmarkResults = makeBenchmarkResults(years, pop)
        const averages = calculatePeriodAverages(
            data,
            benchmarkResults,
            2020,
            2023
        )

        expect(averages.fertilityRate).not.toBeNull()
        expect(averages.fertilityRate!).toBeCloseTo(1.8, 1)
        expect(averages.lifeExpectancy).not.toBeNull()
        expect(averages.lifeExpectancy!).toBeGreaterThan(0)
        expect(averages.netMigrationRate).toBeCloseTo(5, 1)
    })

    it("returns null for fertility and LE with no data, 0 for migration", () => {
        const data = makeTestCountryData([])
        const averages = calculatePeriodAverages(data, {}, 2020, 2023)
        expect(averages.fertilityRate).toBeNull()
        expect(averages.lifeExpectancy).toBeNull()
        // getMigrationRateForYear returns 0 for missing years, so sum/count = 0
        // but actually with no migration data, count will be 4 and all rates 0
        expect(averages.netMigrationRate).toBeCloseTo(0, 5)
    })

    it("correctly computes midYear as (startYear + endYear) / 2", () => {
        const data = makeTestCountryData([2020, 2023])
        const averages = calculatePeriodAverages(data, {}, 2020, 2023)
        expect(averages.midYear).toBe(2021.5)
    })

    it("handles single-year range", () => {
        const pop = makePopulation(1000)
        const data = makeTestCountryData([2020], {
            fertilityRatePerGroup: 40,
            migrationRate: 3,
        })
        const benchmarkResults = makeBenchmarkResults([2020], pop)
        const averages = calculatePeriodAverages(
            data,
            benchmarkResults,
            2020,
            2020
        )
        expect(averages.fertilityRate).not.toBeNull()
        expect(averages.netMigrationRate).toBeCloseTo(3, 1)
        expect(averages.midYear).toBe(2020)
    })
})

describe(calculateTrendProjections, () => {
    // Build data covering both early (2000-2003) and late (2020-2023) periods
    const allYears: number[] = []
    for (let y = 2000; y <= 2023; y++) allYears.push(y)

    it("returns ScenarioParams with entries for all CONTROL_YEARS", () => {
        const pop = makePopulation(1000)
        const data = makeTestCountryData(allYears, {
            fertilityRatePerGroup: 40,
            migrationRate: 2,
        })
        const benchmarkResults = makeBenchmarkResults(allYears, pop)
        const result = calculateTrendProjections(
            data,
            benchmarkResults,
            TEST_CONSTANTS
        )

        for (const year of CONTROL_YEARS) {
            expect(result.fertilityRate[year]).toBeDefined()
            expect(result.lifeExpectancy[year]).toBeDefined()
            expect(result.netMigrationRate[year]).toBeDefined()
        }
    })

    it("holds TFR constant at last-decade average", () => {
        const pop = makePopulation(1000)
        const data = makeTestCountryData(allYears, {
            fertilityRatePerGroup: 40,
            migrationRate: 0,
        })
        const benchmarkResults = makeBenchmarkResults(allYears, pop)
        const result = calculateTrendProjections(
            data,
            benchmarkResults,
            TEST_CONSTANTS
        )

        // All control years should have the same TFR (last-decade constant)
        const tfr2030 = result.fertilityRate[CONTROL_YEARS[0]]
        const tfr2050 = result.fertilityRate[CONTROL_YEARS[1]]
        const tfr2100 = result.fertilityRate[CONTROL_YEARS[2]]
        expect(tfr2030).toBeCloseTo(tfr2050, 2)
        expect(tfr2050).toBeCloseTo(tfr2100, 2)
    })

    it("holds migration constant at last-decade average", () => {
        const pop = makePopulation(1000)
        const data = makeTestCountryData(allYears, {
            fertilityRatePerGroup: 40,
            migrationRate: 5,
        })
        const benchmarkResults = makeBenchmarkResults(allYears, pop)
        const result = calculateTrendProjections(
            data,
            benchmarkResults,
            TEST_CONSTANTS
        )

        // All control years should have same migration
        expect(result.netMigrationRate[CONTROL_YEARS[0]]).toBeCloseTo(
            result.netMigrationRate[CONTROL_YEARS[1]],
            1
        )
    })

    it("clamps LE to [30, 95] range", () => {
        const pop = makePopulation(1000)
        const data = makeTestCountryData(allYears, {
            fertilityRatePerGroup: 40,
        })
        const benchmarkResults = makeBenchmarkResults(allYears, pop)
        const result = calculateTrendProjections(
            data,
            benchmarkResults,
            TEST_CONSTANTS
        )

        for (const year of CONTROL_YEARS) {
            expect(result.lifeExpectancy[year]).toBeGreaterThanOrEqual(30)
            expect(result.lifeExpectancy[year]).toBeLessThanOrEqual(95)
        }
    })
})

describe(calculateFullTrendScenario, () => {
    const allYears: number[] = []
    for (let y = 2000; y <= 2023; y++) allYears.push(y)

    it("extrapolates all three parameters linearly", () => {
        const pop = makePopulation(1000)
        const data = makeTestCountryData(allYears, {
            fertilityRatePerGroup: 40,
            migrationRate: 3,
        })
        const benchmarkResults = makeBenchmarkResults(allYears, pop)
        const result = calculateFullTrendScenario(
            data,
            benchmarkResults,
            TEST_CONSTANTS
        )

        for (const year of CONTROL_YEARS) {
            expect(typeof result.fertilityRate[year]).toBe("number")
            expect(typeof result.lifeExpectancy[year]).toBe("number")
            expect(typeof result.netMigrationRate[year]).toBe("number")
        }
    })

    it("clamps TFR to [0.5, 5.0]", () => {
        const pop = makePopulation(1000)
        const data = makeTestCountryData(allYears, {
            fertilityRatePerGroup: 40,
        })
        const benchmarkResults = makeBenchmarkResults(allYears, pop)
        const result = calculateFullTrendScenario(
            data,
            benchmarkResults,
            TEST_CONSTANTS
        )

        for (const year of CONTROL_YEARS) {
            expect(result.fertilityRate[year]).toBeGreaterThanOrEqual(0.5)
            expect(result.fertilityRate[year]).toBeLessThanOrEqual(5.0)
        }
    })

    it("clamps LE to [30, 95]", () => {
        const pop = makePopulation(1000)
        const data = makeTestCountryData(allYears, {
            fertilityRatePerGroup: 40,
        })
        const benchmarkResults = makeBenchmarkResults(allYears, pop)
        const result = calculateFullTrendScenario(
            data,
            benchmarkResults,
            TEST_CONSTANTS
        )

        for (const year of CONTROL_YEARS) {
            expect(result.lifeExpectancy[year]).toBeGreaterThanOrEqual(30)
            expect(result.lifeExpectancy[year]).toBeLessThanOrEqual(95)
        }
    })

    it("clamps migration to [-20, 20]", () => {
        const pop = makePopulation(1000)
        const data = makeTestCountryData(allYears, {
            fertilityRatePerGroup: 40,
            migrationRate: 0,
        })
        const benchmarkResults = makeBenchmarkResults(allYears, pop)
        const result = calculateFullTrendScenario(
            data,
            benchmarkResults,
            TEST_CONSTANTS
        )

        for (const year of CONTROL_YEARS) {
            expect(result.netMigrationRate[year]).toBeGreaterThanOrEqual(-20)
            expect(result.netMigrationRate[year]).toBeLessThanOrEqual(20)
        }
    })
})

describe(calculateUNWPPScenario, () => {
    const allYears: number[] = []
    for (let y = 2000; y <= 2023; y++) allYears.push(y)

    it("uses UN projection data when available", () => {
        const pop = makePopulation(1000)
        const data = makeTestCountryData(allYears, {
            fertilityRatePerGroup: 40,
        })

        // Add projection scenario data for control years
        const fertRow: Record<string, number> = {}
        for (const ag of FERTILITY_AGE_GROUPS) fertRow[ag] = 30
        for (const year of CONTROL_YEARS) {
            ;(
                data.projectionScenario as {
                    fertility: Record<string, Record<string, number>>
                }
            ).fertility[year] = { ...fertRow }
        }

        const benchmarkResults = makeBenchmarkResults(allYears, pop)
        const result = calculateUNWPPScenario(
            data,
            benchmarkResults,
            TEST_CONSTANTS
        )

        // TFR should be derived from projection fertility data
        // 9 groups * 30 * 5 / 1000 = 1.35
        // But calculateTFR sums single-year rates / 1000, and getProjectionFertilityForYear
        // expands to single years. So we get: 9 groups * 5 ages * 30 / 1000 = 1.35
        for (const year of CONTROL_YEARS) {
            expect(result.fertilityRate[year]).toBeCloseTo(1.35, 1)
        }
    })

    it("falls back to trend extrapolation when projection data is missing", () => {
        const pop = makePopulation(1000)
        const data = makeTestCountryData(allYears, {
            fertilityRatePerGroup: 40,
        })
        // projectionScenario is empty, so it should fall back
        const benchmarkResults = makeBenchmarkResults(allYears, pop)
        const result = calculateUNWPPScenario(
            data,
            benchmarkResults,
            TEST_CONSTANTS
        )

        for (const year of CONTROL_YEARS) {
            expect(result.fertilityRate[year]).toBeGreaterThan(0)
        }
    })

    it("averages migration over 3-year window around each control year", () => {
        const pop = makePopulation(1000)
        const data = makeTestCountryData(allYears, {
            fertilityRatePerGroup: 40,
        })

        // Add projection migration data
        const projMigration: Record<string, { net_migration_rate: number }> = {}
        for (const year of CONTROL_YEARS) {
            projMigration[year - 1] = { net_migration_rate: 2 }
            projMigration[year] = { net_migration_rate: 4 }
            projMigration[year + 1] = { net_migration_rate: 6 }
        }
        ;(
            data.projectionScenario as {
                migration: Record<string, { net_migration_rate: number }>
            }
        ).migration = projMigration

        const benchmarkResults = makeBenchmarkResults(allYears, pop)
        const result = calculateUNWPPScenario(
            data,
            benchmarkResults,
            TEST_CONSTANTS
        )

        // Average of 2, 4, 6 = 4
        for (const year of CONTROL_YEARS) {
            expect(result.netMigrationRate[year]).toBeCloseTo(4, 1)
        }
    })
})
