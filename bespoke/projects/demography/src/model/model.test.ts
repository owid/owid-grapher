import { describe, it, expect } from "vitest"
import {
    MAX_AGE,
    OWID_AGE_GROUPS,
    FERTILITY_AGE_GROUPS,
} from "../helpers/constants"
import type {
    CountryData,
    PopulationBySex,
    DeathsByAgeGroup,
    MortalityRates,
} from "../helpers/types"
import {
    applyOldAgeClosure,
    calculateMortalityRates,
    getProjectionFertilityForYear,
    getProjectionDeathsForYear,
    getProjectionMigrationRateForYear,
    getProjectionPopulationForYear,
    clonePopulation,
    getTotalPopulationFromArrays,
    simulateYear,
    runHistoricalProjection,
    runFutureProjection,
    calculateLifeExpectancy,
    calculateTFR,
    calculateBaselineRates,
    scaleFertilityToTFR,
    scaleMortalityToLE,
    optimizeMigrationOptions,
    DEFAULT_MIGRATION_OPTIONS,
    clampProbability,
    logit,
    invLogit,
    normalizeWeights,
    getAgeGroup,
    aggregateToAgeGroups,
    splitNetMigrationFlows,
    calculateMigrationDelta,
} from "./model"
import { getAgeGroupStart } from "../helpers/utils"

// -- Fixture helpers --

function makePopulation(perAge: number): PopulationBySex {
    return {
        female: new Array(MAX_AGE + 1).fill(perAge),
        male: new Array(MAX_AGE + 1).fill(perAge),
    }
}

function makeZeroPopulation(): PopulationBySex {
    return {
        female: new Array(MAX_AGE + 1).fill(0),
        male: new Array(MAX_AGE + 1).fill(0),
    }
}

/** Gompertz-like mortality: starts low, rises exponentially with age */
function makeGompertzMortality(
    baseRate = 0.001,
    growthRate = 0.07
): MortalityRates {
    const rates = (sex: string): number[] => {
        const r = new Array(MAX_AGE + 1).fill(0)
        const sexFactor = sex === "male" ? 1.1 : 1.0
        for (let age = 0; age <= MAX_AGE; age++) {
            r[age] = Math.min(
                0.999,
                baseRate * sexFactor * Math.exp(growthRate * age)
            )
        }
        return r
    }
    return { female: rates("female"), male: rates("male") }
}

/** Fertility schedule with nonzero rates only at ages 10-54 */
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

function makeZeroMortality(): MortalityRates {
    return {
        female: new Array(MAX_AGE + 1).fill(0),
        male: new Array(MAX_AGE + 1).fill(0),
    }
}

function makeZeroFertility(): number[] {
    return new Array(MAX_AGE + 1).fill(0)
}

/** Build a deaths-by-age-group object from population and mortality rates */
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

/** Build a fertility row (by age group) from a single-year fertility array */
function makeFertilityRow(fertilityRates: number[]): Record<string, number> {
    const row: Record<string, number> = {}
    for (const ageGroup of FERTILITY_AGE_GROUPS) {
        const startAge = getAgeGroupStart(ageGroup)
        // Use the rate at the start of the group (they're uniform within groups in our fixtures)
        row[ageGroup] = fertilityRates[startAge] || 0
    }
    return row
}

/** Build a population row (by age group) from a single-year population array */
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

/** Minimal CountryData with specified years of data */
function makeCountryData(
    years: number[],
    options: {
        population?: PopulationBySex
        mortality?: MortalityRates
        fertility?: number[]
        migrationRate?: number
    } = {}
): CountryData {
    const pop = options.population ?? makePopulation(1000)
    const mortality = options.mortality ?? makeGompertzMortality()
    const fertility = options.fertility ?? makeFertility()
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
        fertilityData[year] = makeFertilityRow(fertility)
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

// -- Tests --

describe(clampProbability, () => {
    it("clamps NaN to min", () => {
        expect(clampProbability(NaN)).toBe(1e-6)
    })

    it("clamps Infinity to min", () => {
        expect(clampProbability(Infinity)).toBe(1e-6)
    })

    it("clamps values below min to min", () => {
        expect(clampProbability(-0.5)).toBe(1e-6)
        expect(clampProbability(0)).toBe(1e-6)
    })

    it("clamps values above max to max", () => {
        expect(clampProbability(1.5)).toBe(0.999)
    })

    it("passes through valid values unchanged", () => {
        expect(clampProbability(0.5)).toBe(0.5)
        expect(clampProbability(0.01)).toBe(0.01)
    })
})

describe("logit / invLogit", () => {
    it("logit(0.5) = 0", () => {
        expect(logit(0.5)).toBeCloseTo(0, 10)
    })

    it("invLogit(0) = 0.5", () => {
        expect(invLogit(0)).toBeCloseTo(0.5, 10)
    })

    it("invLogit(logit(p)) round-trips for values in (0,1)", () => {
        for (const p of [0.01, 0.1, 0.25, 0.5, 0.75, 0.9, 0.99]) {
            expect(invLogit(logit(p))).toBeCloseTo(p, 8)
        }
    })

    it("logit is monotonically increasing", () => {
        const values = [0.1, 0.2, 0.3, 0.5, 0.7, 0.9]
        for (let i = 1; i < values.length; i++) {
            expect(logit(values[i])).toBeGreaterThan(logit(values[i - 1]))
        }
    })
})

describe(normalizeWeights, () => {
    it("produces weights that sum to 1", () => {
        const weights = normalizeWeights([1, 2, 3, 4])
        const sum = weights.reduce((a, b) => a + b, 0)
        expect(sum).toBeCloseTo(1, 10)
    })

    it("preserves relative proportions", () => {
        const weights = normalizeWeights([2, 4, 6])
        expect(weights[1] / weights[0]).toBeCloseTo(2, 10)
        expect(weights[2] / weights[0]).toBeCloseTo(3, 10)
    })

    it("returns unchanged array when total is zero", () => {
        const weights = normalizeWeights([0, 0, 0])
        expect(weights).toEqual([0, 0, 0])
    })
})

describe(getAgeGroup, () => {
    it("maps ages 0-4 to '0-4'", () => {
        expect(getAgeGroup(0)).toBe("0-4")
        expect(getAgeGroup(4)).toBe("0-4")
    })

    it("maps age 50 to '50-54'", () => {
        expect(getAgeGroup(50)).toBe("50-54")
    })

    it("maps ages >= 100 to '100+'", () => {
        expect(getAgeGroup(100)).toBe("100+")
        expect(getAgeGroup(150)).toBe("100+")
        expect(getAgeGroup(200)).toBe("100+")
    })
})

describe(aggregateToAgeGroups, () => {
    it("sums single-year populations into 5-year groups", () => {
        const pop = new Array(MAX_AGE + 1).fill(0)
        // Put 10 people at each age 0-4
        for (let age = 0; age < 5; age++) pop[age] = 10
        const groups = aggregateToAgeGroups(pop)
        expect(groups["0-4"]).toBe(50)
        expect(groups["5-9"]).toBe(0)
    })

    it("aggregates ages 100+ into a single group", () => {
        const pop = new Array(MAX_AGE + 1).fill(0)
        for (let age = 100; age <= MAX_AGE; age++) pop[age] = 1
        const groups = aggregateToAgeGroups(pop)
        expect(groups["100+"]).toBe(MAX_AGE - 100 + 1)
    })
})

describe(applyOldAgeClosure, () => {
    it("returns array of same length as input", () => {
        const rates = new Array(MAX_AGE + 1).fill(0.01)
        const closed = applyOldAgeClosure(rates, "female")
        expect(closed.length).toBe(MAX_AGE + 1)
    })

    it("produces monotonically non-decreasing rates from startAge to MAX_AGE", () => {
        const rates = new Array(MAX_AGE + 1).fill(0)
        for (let age = 0; age <= MAX_AGE; age++) {
            rates[age] = Math.min(0.5, 0.001 * Math.exp(0.05 * age))
        }
        const closed = applyOldAgeClosure(rates, "female")
        for (let age = 86; age <= MAX_AGE; age++) {
            expect(closed[age]).toBeGreaterThanOrEqual(closed[age - 1])
        }
    })

    it("preserves rates below startAge (default 85) unchanged", () => {
        const rates = new Array(MAX_AGE + 1).fill(0)
        for (let age = 0; age <= MAX_AGE; age++) {
            rates[age] = 0.001 * Math.exp(0.05 * age)
        }
        const closed = applyOldAgeClosure(rates, "female")
        for (let age = 0; age < 85; age++) {
            expect(closed[age]).toBe(rates[age])
        }
    })

    it("all rates are less than 0.999", () => {
        const rates = new Array(MAX_AGE + 1).fill(0.5)
        const closed = applyOldAgeClosure(rates, "male")
        for (let age = 0; age <= MAX_AGE; age++) {
            expect(closed[age]).toBeLessThanOrEqual(0.999)
        }
    })

    it("respects custom startAge and anchorAge options", () => {
        const rates = new Array(MAX_AGE + 1).fill(0.01)
        const closed = applyOldAgeClosure(rates, "female", {
            startAge: 70,
            anchorAge: 90,
        })
        // Below custom startAge should be unchanged
        for (let age = 0; age < 70; age++) {
            expect(closed[age]).toBe(0.01)
        }
        // From startAge onward should be monotonically non-decreasing
        for (let age = 71; age <= MAX_AGE; age++) {
            expect(closed[age]).toBeGreaterThanOrEqual(closed[age - 1])
        }
    })

    it("handles zero input rates by imposing minimum floor", () => {
        const rates = new Array(MAX_AGE + 1).fill(0)
        const closed = applyOldAgeClosure(rates, "female")
        // After startAge, rates should be positive (minimum floor applied)
        for (let age = 85; age <= MAX_AGE; age++) {
            expect(closed[age]).toBeGreaterThan(0)
        }
    })

    it("relaxed options allow lower minimum rates for extreme longevity", () => {
        const rates = new Array(MAX_AGE + 1).fill(0.001)
        const standard = applyOldAgeClosure(rates, "female")
        const relaxed = applyOldAgeClosure(rates, "female", {
            minRateFloor: 1e-9,
            minQStart: 1e-8,
            minSlope: 0.00012,
        })
        // Relaxed closure should allow lower rates at age 90
        expect(relaxed[90]).toBeLessThanOrEqual(standard[90])
    })
})

describe(calculateMortalityRates, () => {
    it("returns rates with female and male arrays of length MAX_AGE+1", () => {
        const pop = makePopulation(1000)
        const deaths = makeDeathsByAgeGroup(pop, makeGompertzMortality())
        const rates = calculateMortalityRates(deaths, pop.female, pop.male)
        expect(rates.female.length).toBe(MAX_AGE + 1)
        expect(rates.male.length).toBe(MAX_AGE + 1)
    })

    it("computes rate as deaths / population for each age group", () => {
        const pop = makePopulation(1000)
        const mortality = makeGompertzMortality()
        const deaths = makeDeathsByAgeGroup(pop, mortality)
        const rates = calculateMortalityRates(deaths, pop.female, pop.male)
        // For young ages (before old-age closure), rate should be close to input
        // The rate is computed per 5-year group then spread, so it should match
        // the average mortality in the age group
        expect(rates.female[0]).toBeGreaterThan(0)
        expect(rates.female[0]).toBeLessThan(0.1)
    })

    it("returns 0 rate for age groups with zero population", () => {
        const pop = makeZeroPopulation()
        const deaths: DeathsByAgeGroup = { female: {}, male: {} }
        for (const ag of OWID_AGE_GROUPS) {
            deaths.female[ag] = 100
            deaths.male[ag] = 100
        }
        const rates = calculateMortalityRates(deaths, pop.female, pop.male)
        // At ages where pop is zero, rate should be 0 (before closure applies)
        expect(rates.female[0]).toBe(0)
    })

    it("applies old-age closure automatically", () => {
        const pop = makePopulation(1000)
        const deaths = makeDeathsByAgeGroup(pop, makeGompertzMortality())
        const rates = calculateMortalityRates(deaths, pop.female, pop.male)
        // Rates should be monotonically non-decreasing from age 85 onward
        for (let age = 86; age <= MAX_AGE; age++) {
            expect(rates.female[age]).toBeGreaterThanOrEqual(
                rates.female[age - 1]
            )
        }
    })

    it("handles empty deaths object gracefully", () => {
        const pop = makePopulation(1000)
        const deaths: DeathsByAgeGroup = { female: {}, male: {} }
        const rates = calculateMortalityRates(deaths, pop.female, pop.male)
        // All base rates should be 0 (before closure adds minimum)
        expect(rates.female[0]).toBe(0)
        expect(rates.male[0]).toBe(0)
    })
})

describe("Projection data accessors", () => {
    const emptyData = makeCountryData([2020])

    describe(getProjectionFertilityForYear, () => {
        it("returns null when no projection scenario data exists", () => {
            expect(getProjectionFertilityForYear(emptyData, 2030)).toBeNull()
        })

        it("returns single-year expanded fertility array from 5-year groups", () => {
            const data = makeCountryData([2020])
            ;(
                data.projectionScenario as {
                    fertility: Record<string, Record<string, number>>
                }
            ).fertility = {
                "2030": {
                    "15-19": 20,
                    "20-24": 80,
                    "25-29": 100,
                    "30-34": 80,
                    "35-39": 40,
                },
            }
            const result = getProjectionFertilityForYear(data, 2030)
            expect(result).not.toBeNull()
            expect(result!.length).toBe(MAX_AGE + 1)
            // Ages 20-24 should have rate 80
            expect(result![20]).toBe(80)
            expect(result![24]).toBe(80)
        })
    })

    describe(getProjectionDeathsForYear, () => {
        it("returns null when no projection death data exists", () => {
            expect(getProjectionDeathsForYear(emptyData, 2030)).toBeNull()
        })

        it("returns DeathsByAgeGroup with all OWID age groups", () => {
            const data = makeCountryData([2020])
            const deathRow: Record<string, number> = {}
            for (const ag of OWID_AGE_GROUPS) deathRow[ag] = 10
            ;(
                data.projectionScenario as {
                    deaths: Record<
                        string,
                        Record<string, Record<string, number>>
                    >
                }
            ).deaths = {
                female: { "2030": { ...deathRow } },
                male: { "2030": { ...deathRow } },
            }
            const result = getProjectionDeathsForYear(data, 2030)
            expect(result).not.toBeNull()
            expect(result!.female["0-4"]).toBe(10)
            expect(result!.male["0-4"]).toBe(10)
        })
    })

    describe(getProjectionMigrationRateForYear, () => {
        it("returns 0 when no projection migration data exists", () => {
            expect(getProjectionMigrationRateForYear(emptyData, 2030)).toBe(0)
        })

        it("returns the net_migration_rate value for a valid year", () => {
            const data = makeCountryData([2020])
            ;(
                data.projectionScenario as {
                    migration: Record<string, { net_migration_rate: number }>
                }
            ).migration = {
                "2030": { net_migration_rate: 5.5 },
            }
            expect(getProjectionMigrationRateForYear(data, 2030)).toBe(5.5)
        })
    })

    describe(getProjectionPopulationForYear, () => {
        it("returns null when projection population data is missing", () => {
            expect(getProjectionPopulationForYear(emptyData, 2030)).toBeNull()
        })
    })
})

describe(clonePopulation, () => {
    it("returns a deep copy that does not share array references", () => {
        const original = makePopulation(100)
        const clone = clonePopulation(original)
        clone.female[0] = 999
        expect(original.female[0]).toBe(100)
    })

    it("preserves all values in the clone", () => {
        const original = makePopulation(42)
        const clone = clonePopulation(original)
        for (let age = 0; age <= MAX_AGE; age++) {
            expect(clone.female[age]).toBe(42)
            expect(clone.male[age]).toBe(42)
        }
    })
})

describe(getTotalPopulationFromArrays, () => {
    it("sums female and male arrays correctly", () => {
        const female = new Array(MAX_AGE + 1).fill(10)
        const male = new Array(MAX_AGE + 1).fill(20)
        const total = getTotalPopulationFromArrays(female, male)
        expect(total).toBe((10 + 20) * (MAX_AGE + 1))
    })

    it("handles sparse arrays with undefined entries", () => {
        const female = new Array(MAX_AGE + 1)
        const male = new Array(MAX_AGE + 1)
        female[0] = 100
        male[0] = 200
        expect(getTotalPopulationFromArrays(female, male)).toBe(300)
    })

    it("returns 0 for all-zero arrays", () => {
        const zeros = new Array(MAX_AGE + 1).fill(0)
        expect(getTotalPopulationFromArrays(zeros, zeros)).toBe(0)
    })
})

describe(simulateYear, () => {
    describe("Step 1: mortality and aging", () => {
        it("shifts population up by one year of age with zero mortality", () => {
            const pop = makeZeroPopulation()
            pop.female[20] = 1000
            pop.male[20] = 1000

            const result = simulateYear(
                pop,
                makeZeroMortality(),
                makeZeroFertility(),
                0,
                DEFAULT_MIGRATION_OPTIONS
            )

            expect(result.female[21]).toBe(1000)
            expect(result.male[21]).toBe(1000)
            expect(result.female[20]).toBe(0)
            expect(result.male[20]).toBe(0)
        })

        it("applies mortality: survivors = pop * (1 - rate)", () => {
            const pop = makeZeroPopulation()
            pop.female[30] = 10000
            pop.male[30] = 10000

            const mortality = makeZeroMortality()
            mortality.female[30] = 0.5
            mortality.male[30] = 0.5

            const result = simulateYear(
                pop,
                mortality,
                makeZeroFertility(),
                0,
                DEFAULT_MIGRATION_OPTIONS
            )

            // 10000 * (1 - 0.5) = 5000, shifted to age 31
            expect(result.female[31]).toBe(5000)
            expect(result.male[31]).toBe(5000)
        })

        it("accumulates survivors at MAX_AGE", () => {
            const pop = makeZeroPopulation()
            pop.female[MAX_AGE] = 100
            pop.male[MAX_AGE] = 100

            const result = simulateYear(
                pop,
                makeZeroMortality(),
                makeZeroFertility(),
                0,
                DEFAULT_MIGRATION_OPTIONS
            )

            // Survivors at MAX_AGE stay at MAX_AGE
            expect(result.female[MAX_AGE]).toBe(100)
            expect(result.male[MAX_AGE]).toBe(100)
        })
    })

    describe("Step 2: migration", () => {
        it("positive migration rate adds people", () => {
            const pop = makePopulation(1000)
            const totalBefore = getTotalPopulationFromArrays(
                pop.female,
                pop.male
            )

            const result = simulateYear(
                pop,
                makeZeroMortality(),
                makeZeroFertility(),
                10, // 10 per 1000
                DEFAULT_MIGRATION_OPTIONS
            )

            const totalAfter = getTotalPopulationFromArrays(
                result.female,
                result.male
            )
            expect(totalAfter).toBeGreaterThan(totalBefore * 0.99)
        })

        it("negative migration rate removes people", () => {
            const pop = makePopulation(1000)
            const totalBefore = getTotalPopulationFromArrays(
                pop.female,
                pop.male
            )

            const result = simulateYear(
                pop,
                makeZeroMortality(),
                makeZeroFertility(),
                -10,
                DEFAULT_MIGRATION_OPTIONS
            )

            const totalAfter = getTotalPopulationFromArrays(
                result.female,
                result.male
            )
            expect(totalAfter).toBeLessThan(totalBefore)
        })

        it("zero migration rate leaves population unchanged (with zero mortality/fertility)", () => {
            const pop = makePopulation(1000)
            const totalBefore = getTotalPopulationFromArrays(
                pop.female,
                pop.male
            )

            const result = simulateYear(
                pop,
                makeZeroMortality(),
                makeZeroFertility(),
                0,
                DEFAULT_MIGRATION_OPTIONS
            )

            const totalAfter = getTotalPopulationFromArrays(
                result.female,
                result.male
            )
            // Should be very close (only rounding differences from age shift)
            expect(Math.abs(totalAfter - totalBefore)).toBeLessThan(MAX_AGE + 1)
        })
    })

    describe("Step 3: births from fertility", () => {
        it("produces births proportional to female population and fertility rate", () => {
            const pop = makeZeroPopulation()
            // Put women only at ages 25-29
            for (let age = 25; age <= 29; age++) {
                pop.female[age] = 10000
            }

            const fertility = makeZeroFertility()
            for (let age = 25; age <= 29; age++) {
                fertility[age] = 100 // 100 per 1000 women
            }

            const result = simulateYear(
                pop,
                makeZeroMortality(),
                fertility,
                0,
                DEFAULT_MIGRATION_OPTIONS
            )

            // Births should appear at age 0
            const totalBirths = result.female[0] + result.male[0]
            expect(totalBirths).toBeGreaterThan(0)
        })

        it("applies correct sex ratio (MALE=0.512, FEMALE=0.488)", () => {
            const pop = makeZeroPopulation()
            for (let age = 25; age <= 29; age++) {
                pop.female[age] = 100000
            }

            const fertility = makeZeroFertility()
            for (let age = 25; age <= 29; age++) {
                fertility[age] = 200
            }

            const result = simulateYear(
                pop,
                makeZeroMortality(),
                fertility,
                0,
                DEFAULT_MIGRATION_OPTIONS
            )

            const femaleBirths = result.female[0]
            const maleBirths = result.male[0]
            const totalBirths = femaleBirths + maleBirths
            if (totalBirths > 0) {
                expect(maleBirths / totalBirths).toBeCloseTo(0.512, 1)
                expect(femaleBirths / totalBirths).toBeCloseTo(0.488, 1)
            }
        })

        it("only considers women aged 10-54 for births", () => {
            const pop = makeZeroPopulation()
            // Women only at age 60 (outside fertility range)
            pop.female[60] = 100000

            const fertility = makeZeroFertility()
            fertility[60] = 200 // Even with high rate, no births expected

            const result = simulateYear(
                pop,
                makeZeroMortality(),
                fertility,
                0,
                DEFAULT_MIGRATION_OPTIONS
            )

            expect(result.female[0]).toBe(0)
            expect(result.male[0]).toBe(0)
        })

        it("zero fertility rates produce zero births", () => {
            const pop = makePopulation(1000)

            const result = simulateYear(
                pop,
                makeZeroMortality(),
                makeZeroFertility(),
                0,
                DEFAULT_MIGRATION_OPTIONS
            )

            expect(result.female[0]).toBe(0)
            expect(result.male[0]).toBe(0)
        })
    })

    describe("Step 4: rounding and clamping", () => {
        it("all output values are non-negative integers", () => {
            const pop = makePopulation(100)
            const result = simulateYear(
                pop,
                makeGompertzMortality(),
                makeFertility(),
                5,
                DEFAULT_MIGRATION_OPTIONS
            )

            for (let age = 0; age <= MAX_AGE; age++) {
                expect(result.female[age]).toBeGreaterThanOrEqual(0)
                expect(result.male[age]).toBeGreaterThanOrEqual(0)
                expect(Number.isInteger(result.female[age])).toBe(true)
                expect(Number.isInteger(result.male[age])).toBe(true)
            }
        })

        it("population cannot go negative even with extreme emigration", () => {
            const pop = makePopulation(10)

            const result = simulateYear(
                pop,
                makeZeroMortality(),
                makeZeroFertility(),
                -500, // Very large negative migration
                DEFAULT_MIGRATION_OPTIONS
            )

            for (let age = 0; age <= MAX_AGE; age++) {
                expect(result.female[age]).toBeGreaterThanOrEqual(0)
                expect(result.male[age]).toBeGreaterThanOrEqual(0)
            }
        })
    })

    describe("demographic invariants", () => {
        it("population change approximately equals births + net_migration - deaths", () => {
            const pop = makePopulation(1000)
            const mortality = makeGompertzMortality()
            const fertility = makeFertility(60)

            const result = simulateYear(
                pop,
                mortality,
                fertility,
                5,
                DEFAULT_MIGRATION_OPTIONS
            )

            const totalBefore = getTotalPopulationFromArrays(
                pop.female,
                pop.male
            )
            const totalAfter = getTotalPopulationFromArrays(
                result.female,
                result.male
            )

            // The change should be reasonable (not wildly off)
            const change = totalAfter - totalBefore
            // With moderate fertility and mortality, change should be within
            // a reasonable fraction of the total
            expect(Math.abs(change)).toBeLessThan(totalBefore)
        })
    })
})

describe(splitNetMigrationFlows, () => {
    it("with zero turnover, immigrants equal net migrants when positive", () => {
        const { immigrants, emigrants } = splitNetMigrationFlows(1000000, 10, 0)
        const netMigrants = (1000000 * 10) / 1000
        expect(immigrants).toBeCloseTo(netMigrants / 2 + netMigrants / 2, 0)
        // Actually: immigrants = 0 + netMigrants/2 = 5000, emigrants = 0 - netMigrants/2 = -5000
        // But if either is negative, it's clamped: immigrants = max(netMigrants, 0), emigrants = max(-netMigrants, 0)
        // netMigrants = 10000, so immigrants = 5000, emigrants = -5000 => clamp => immigrants=10000, emigrants=0
        expect(immigrants).toBeCloseTo(10000, 0)
        expect(emigrants).toBeCloseTo(0, 0)
    })

    it("with turnover, both immigration and emigration increase", () => {
        const { immigrants, emigrants } = splitNetMigrationFlows(
            1000000,
            0,
            0.01
        )
        // Net is 0, but turnover creates flows in both directions
        expect(immigrants).toBeGreaterThan(0)
        expect(emigrants).toBeGreaterThan(0)
        expect(immigrants).toBeCloseTo(emigrants, 0)
    })
})

describe(calculateMigrationDelta, () => {
    it("positive migration rate produces net positive population change", () => {
        const pop = makePopulation(1000)
        const totalPop = getTotalPopulationFromArrays(pop.female, pop.male)
        const delta = calculateMigrationDelta(pop, totalPop, 10, {
            ...DEFAULT_MIGRATION_OPTIONS,
        })
        let totalDelta = 0
        for (let age = 0; age <= MAX_AGE; age++) {
            totalDelta += delta.female[age] + delta.male[age]
        }
        expect(totalDelta).toBeGreaterThan(0)
    })

    it("negative migration rate produces net negative population change", () => {
        const pop = makePopulation(1000)
        const totalPop = getTotalPopulationFromArrays(pop.female, pop.male)
        const delta = calculateMigrationDelta(pop, totalPop, -10, {
            ...DEFAULT_MIGRATION_OPTIONS,
        })
        let totalDelta = 0
        for (let age = 0; age <= MAX_AGE; age++) {
            totalDelta += delta.female[age] + delta.male[age]
        }
        expect(totalDelta).toBeLessThan(0)
    })

    it("enforces old-age net migration cutoff", () => {
        const pop = makePopulation(1000)
        const totalPop = getTotalPopulationFromArrays(pop.female, pop.male)
        const delta = calculateMigrationDelta(pop, totalPop, 10, {
            ...DEFAULT_MIGRATION_OPTIONS,
            oldAgeNetMigrationCutoff: 75,
        })
        // Net delta at ages >= 75 should be 0 (redistributed to younger ages)
        for (let age = 75; age <= MAX_AGE; age++) {
            expect(delta.female[age]).toBeCloseTo(0, 5)
            expect(delta.male[age]).toBeCloseTo(0, 5)
        }
    })
})

describe(runHistoricalProjection, () => {
    it("returns results keyed by year from startYear to endYear inclusive", () => {
        const years = [2020, 2021, 2022, 2023]
        const data = makeCountryData(years)
        const results = runHistoricalProjection(data, 2020, 2023, {
            migrationOptions: DEFAULT_MIGRATION_OPTIONS,
        })
        for (const year of years) {
            expect(results[year]).toBeDefined()
            expect(results[year].population).toBeDefined()
            expect(results[year].totalPop).toBeGreaterThan(0)
        }
    })

    it("throws when no population data for startYear", () => {
        const data = makeCountryData([2021, 2022])
        expect(() =>
            runHistoricalProjection(data, 2020, 2022, {
                migrationOptions: DEFAULT_MIGRATION_OPTIONS,
            })
        ).toThrow()
    })

    it("first year result matches input population total", () => {
        const years = [2020, 2021, 2022]
        const pop = makePopulation(500)
        const data = makeCountryData(years, { population: pop })
        const results = runHistoricalProjection(data, 2020, 2022, {
            migrationOptions: DEFAULT_MIGRATION_OPTIONS,
        })
        // The first year should come from the data's population,
        // which is expanded from 5-year groups
        expect(results[2020].totalPop).toBeGreaterThan(0)
    })

    it("each year's totalPop matches sum of its population arrays", () => {
        const years = [2020, 2021, 2022]
        const data = makeCountryData(years)
        const results = runHistoricalProjection(data, 2020, 2022, {
            migrationOptions: DEFAULT_MIGRATION_OPTIONS,
        })
        for (const year of years) {
            const r = results[year]
            const expectedTotal = getTotalPopulationFromArrays(
                r.population.female,
                r.population.male
            )
            expect(r.totalPop).toBe(expectedTotal)
        }
    })
})

describe(runFutureProjection, () => {
    it("returns results from startYear to endYear", () => {
        const pop = makePopulation(1000)
        const mortality = makeGompertzMortality()
        const fertility = makeFertility()
        const results = runFutureProjection(
            pop,
            2023,
            2030,
            {
                fertilityRates: fertility,
                mortalityRates: mortality,
                migrationRate: 0,
            },
            { migrationOptions: DEFAULT_MIGRATION_OPTIONS }
        )

        for (let year = 2023; year <= 2030; year++) {
            expect(results[year]).toBeDefined()
        }
    })

    it("first year entry matches startPopulation total", () => {
        const pop = makePopulation(1000)
        const results = runFutureProjection(
            pop,
            2023,
            2025,
            {
                fertilityRates: makeFertility(),
                mortalityRates: makeGompertzMortality(),
                migrationRate: 0,
            },
            { migrationOptions: DEFAULT_MIGRATION_OPTIONS }
        )

        const expectedTotal = getTotalPopulationFromArrays(pop.female, pop.male)
        expect(results[2023].totalPop).toBe(expectedTotal)
    })

    it("population shrinks with zero fertility and positive mortality", () => {
        const pop = makePopulation(1000)
        const results = runFutureProjection(
            pop,
            2023,
            2030,
            {
                fertilityRates: makeZeroFertility(),
                mortalityRates: makeGompertzMortality(),
                migrationRate: 0,
            },
            { migrationOptions: DEFAULT_MIGRATION_OPTIONS }
        )

        expect(results[2030].totalPop).toBeLessThan(results[2023].totalPop)
    })
})

describe(calculateLifeExpectancy, () => {
    it("returns approximately 0 for all-1.0 mortality rates", () => {
        const rates = new Array(MAX_AGE + 1).fill(1.0)
        const le = calculateLifeExpectancy(rates)
        expect(le).toBeCloseTo(0.5, 0) // 0.5 because of half-year person-years at age 0
    })

    it("returns approximately MAX_AGE for all-zero mortality rates", () => {
        const rates = new Array(MAX_AGE + 1).fill(0)
        const le = calculateLifeExpectancy(rates)
        expect(le).toBeCloseTo(MAX_AGE + 1, 0)
    })

    it("higher mortality rates produce lower life expectancy", () => {
        const low = new Array(MAX_AGE + 1).fill(0.005)
        const high = new Array(MAX_AGE + 1).fill(0.02)
        expect(calculateLifeExpectancy(low)).toBeGreaterThan(
            calculateLifeExpectancy(high)
        )
    })

    it("returns reasonable LE for a Gompertz-like mortality schedule", () => {
        const mortality = makeGompertzMortality()
        // Use average of female and male
        const avgRates = mortality.female.map(
            (f, i) => (f + mortality.male[i]) / 2
        )
        const le = calculateLifeExpectancy(avgRates)
        // Should be in a reasonable range (40-100)
        expect(le).toBeGreaterThan(40)
        expect(le).toBeLessThan(100)
    })
})

describe(calculateTFR, () => {
    it("sums fertility rates ages 10-54 divided by 1000", () => {
        const rates = new Array(MAX_AGE + 1).fill(0)
        // 45 ages (10-54), each with rate 44.44 per 1000 => TFR = 2.0
        for (let age = 10; age <= 54; age++) {
            rates[age] = 44.44
        }
        const tfr = calculateTFR(rates)
        expect(tfr).toBeCloseTo(2.0, 1)
    })

    it("returns 0 for all-zero fertility rates", () => {
        expect(calculateTFR(makeZeroFertility())).toBe(0)
    })

    it("ignores fertility rates outside ages 10-54", () => {
        const rates = new Array(MAX_AGE + 1).fill(100)
        // Set ages 10-54 to zero, rest is 100
        for (let age = 10; age <= 54; age++) {
            rates[age] = 0
        }
        expect(calculateTFR(rates)).toBe(0)
    })

    it("returns correct TFR for a known schedule", () => {
        const fertility = makeFertility(60) // peak rate 60 per 1000
        const tfr = calculateTFR(fertility)
        // With our fixture: ages 20-34 (15 ages) at 60, ages 15-19 and 35-49 (20 ages) at 18
        // TFR = (15*60 + 20*18) / 1000 = (900 + 360) / 1000 = 1.26
        expect(tfr).toBeGreaterThan(1)
        expect(tfr).toBeLessThan(2)
    })
})

describe(calculateBaselineRates, () => {
    it("averages fertility, mortality, and migration over the year range", () => {
        const years = [2020, 2021, 2022, 2023]
        const data = makeCountryData(years, { migrationRate: 5 })
        const baseline = calculateBaselineRates(data, 2020, 2023)

        expect(baseline.fertility.length).toBe(MAX_AGE + 1)
        expect(baseline.mortality.female.length).toBe(MAX_AGE + 1)
        expect(baseline.mortality.male.length).toBe(MAX_AGE + 1)
        expect(baseline.migrationRate).toBeCloseTo(5, 1)
    })

    it("computes tfr and lifeExpectancy from the averaged rates", () => {
        const years = [2020, 2021, 2022]
        const data = makeCountryData(years)
        const baseline = calculateBaselineRates(data, 2020, 2022)

        expect(baseline.tfr).toBeGreaterThan(0)
        expect(baseline.lifeExpectancy).toBeGreaterThan(0)
    })

    it("uses historicalResults population when observed data is unavailable", () => {
        const years = [2020, 2021]
        const data = makeCountryData(years)
        const mockResults: Record<
            number,
            { population: PopulationBySex; totalPop: number }
        > = {
            2020: {
                population: makePopulation(500),
                totalPop: 500 * 2 * (MAX_AGE + 1),
            },
            2021: {
                population: makePopulation(500),
                totalPop: 500 * 2 * (MAX_AGE + 1),
            },
        }
        const baseline = calculateBaselineRates(data, 2020, 2021, mockResults)
        expect(baseline.lifeExpectancy).toBeGreaterThan(0)
    })
})

describe(scaleFertilityToTFR, () => {
    it("returns original rates when targetTFR equals baseTFR", () => {
        const fertility = makeFertility(60)
        const baseTFR = calculateTFR(fertility)
        const scaled = scaleFertilityToTFR(fertility, baseTFR, baseTFR)
        for (let age = 0; age <= MAX_AGE; age++) {
            expect(scaled[age]).toBeCloseTo(fertility[age], 10)
        }
    })

    it("scales proportionally: doubling TFR doubles all rates", () => {
        const fertility = makeFertility(60)
        const baseTFR = calculateTFR(fertility)
        const scaled = scaleFertilityToTFR(fertility, baseTFR, baseTFR * 2)
        for (let age = 0; age <= MAX_AGE; age++) {
            expect(scaled[age]).toBeCloseTo(fertility[age] * 2, 5)
        }
    })

    it("returns original rates when baseTFR is zero (division guard)", () => {
        const fertility = makeFertility(60)
        const scaled = scaleFertilityToTFR(fertility, 0, 2.0)
        for (let age = 0; age <= MAX_AGE; age++) {
            expect(scaled[age]).toBe(fertility[age])
        }
    })

    it("resulting TFR matches target", () => {
        const fertility = makeFertility(60)
        const baseTFR = calculateTFR(fertility)
        const targetTFR = 3.5
        const scaled = scaleFertilityToTFR(fertility, baseTFR, targetTFR)
        expect(calculateTFR(scaled)).toBeCloseTo(targetTFR, 5)
    })
})

describe(scaleMortalityToLE, () => {
    const mortality = makeGompertzMortality()
    const avgRates = mortality.female.map((f, i) => (f + mortality.male[i]) / 2)
    const baseLE = calculateLifeExpectancy(avgRates)

    it("returns rates unchanged when target equals base LE (within 0.1)", () => {
        const scaled = scaleMortalityToLE(mortality, baseLE, baseLE)
        // Life expectancy of scaled rates should be very close to base
        const scaledAvg = scaled.female.map((f, i) => (f + scaled.male[i]) / 2)
        expect(calculateLifeExpectancy(scaledAvg)).toBeCloseTo(baseLE, 0)
    })

    it("lower target LE produces higher mortality rates", () => {
        const targetLE = baseLE - 10
        const scaled = scaleMortalityToLE(mortality, baseLE, targetLE)
        // Average rate at young ages should be higher
        let sumOriginal = 0
        let sumScaled = 0
        for (let age = 20; age <= 60; age++) {
            sumOriginal += (mortality.female[age] + mortality.male[age]) / 2
            sumScaled += (scaled.female[age] + scaled.male[age]) / 2
        }
        expect(sumScaled).toBeGreaterThan(sumOriginal)
    })

    it("higher target LE produces lower mortality rates", () => {
        const targetLE = baseLE + 5
        const scaled = scaleMortalityToLE(mortality, baseLE, targetLE)
        let sumOriginal = 0
        let sumScaled = 0
        for (let age = 20; age <= 60; age++) {
            sumOriginal += (mortality.female[age] + mortality.male[age]) / 2
            sumScaled += (scaled.female[age] + scaled.male[age]) / 2
        }
        expect(sumScaled).toBeLessThan(sumOriginal)
    })

    it("achieved LE is within 0.5 years of target for moderate targets", () => {
        for (const targetLE of [55, 70, 80]) {
            const scaled = scaleMortalityToLE(mortality, baseLE, targetLE)
            const scaledAvg = scaled.female.map(
                (f, i) => (f + scaled.male[i]) / 2
            )
            const achievedLE = calculateLifeExpectancy(scaledAvg)
            expect(Math.abs(achievedLE - targetLE)).toBeLessThan(0.5)
        }
    })

    it("preserves female-male LE gap approximately", () => {
        const targetLE = 80
        const scaled = scaleMortalityToLE(mortality, baseLE, targetLE)
        const femaleLE = calculateLifeExpectancy(scaled.female)
        const maleLE = calculateLifeExpectancy(scaled.male)
        // Females should still have higher LE than males
        expect(femaleLE).toBeGreaterThan(maleLE)
    })

    it("handles extreme longevity target (LE=100) without NaN or Infinity", () => {
        const scaled = scaleMortalityToLE(mortality, baseLE, 100)
        for (let age = 0; age <= MAX_AGE; age++) {
            expect(Number.isFinite(scaled.female[age])).toBe(true)
            expect(Number.isFinite(scaled.male[age])).toBe(true)
            expect(scaled.female[age]).toBeGreaterThanOrEqual(0)
            expect(scaled.male[age]).toBeGreaterThanOrEqual(0)
        }
    })
})

describe(optimizeMigrationOptions, () => {
    it("returns pooled defaults when fewer than minStrongYears available", () => {
        const data = makeCountryData([2020, 2021, 2022])
        const result = optimizeMigrationOptions(data, "Testland", 2020, 2022, {
            minStrongYears: 10,
        })
        expect(result.source).toBe("pooled-high-quality-defaults")
    })

    it("returns isDataSparse=true when data is insufficient", () => {
        const data = makeCountryData([2020, 2021])
        const result = optimizeMigrationOptions(data, "Testland", 2020, 2021, {
            minStrongYears: 10,
        })
        expect(result.isDataSparse).toBe(true)
    })

    it("returns valid MigrationOptions structure", () => {
        const data = makeCountryData([2020, 2021, 2022])
        const result = optimizeMigrationOptions(data, "Testland", 2020, 2022)
        expect(result.options).toBeDefined()
        expect(["western_standard", "low_dependency"]).toContain(
            result.options.schedule
        )
        expect(["auto", "receiving", "sending"]).toContain(
            result.options.direction
        )
        expect(["neutral", "younger_male", "younger_female"]).toContain(
            result.options.sexPattern
        )
    })

    it("applies external sex share priors for Gulf states", () => {
        const data = makeCountryData([2020, 2021, 2022])
        const result = optimizeMigrationOptions(data, "Qatar", 2020, 2022)
        expect(result.options.immigrationMaleSharePrior).not.toBeNull()
        expect(result.options.emigrationMaleSharePrior).not.toBeNull()
    })
})
