/**
 * Scenario generation helpers.
 */

import {
    FERTILITY_AGE_GROUPS,
    calculateMortalityRates,
    getDeathsForYear,
    getFertilityForYear,
    getMigrationRateForYear,
    getPopulationForYear,
    getProjectionDeathsForYear,
    getProjectionFertilityForYear,
    getProjectionMigrationRateForYear,
    getProjectionPopulationForYear,
    type CountryData,
} from "./data"
import { calculateTFR, type BaselineParams, type YearResult } from "./model"
import type {
    CONTROL_YEARS,
    HISTORICAL_END_YEAR,
    TREND_EARLY_START,
    TREND_EARLY_END,
    TREND_LATE_START,
    TREND_LATE_END,
} from "./constants"

/** The subset of constants this module needs */
export interface ScenarioConstants {
    HISTORICAL_END_YEAR: number
    CONTROL_YEARS: readonly number[]
    TREND_EARLY_START: number
    TREND_EARLY_END: number
    TREND_LATE_START: number
    TREND_LATE_END: number
}

export interface ScenarioParams {
    tfr: Record<number, number>
    lifeExpectancy: Record<number, number>
    migration: Record<number, number>
}

export function calculateTFRFromRaw(
    fertilityRow: Record<string, number> | undefined
): number | null {
    if (!fertilityRow) return null
    let tfr = 0
    for (const ageGroup of FERTILITY_AGE_GROUPS) {
        tfr += ((fertilityRow[ageGroup] || 0) * 5) / 1000
    }
    return tfr
}

export function estimateLifeExpectancy(
    deaths: { female: Record<string, number>; male: Record<string, number> },
    femalePop: number[],
    malePop: number[]
): number {
    const mortalityRates = calculateMortalityRates(deaths, femalePop, malePop)
    const MAX_AGE = femalePop.length - 1

    let survivors = 100000
    let totalYearsLived = 0

    for (let age = 0; age <= MAX_AGE; age++) {
        const rate =
            ((mortalityRates.female?.[age] || 0) +
                (mortalityRates.male?.[age] || 0)) /
            2
        const deathCount = survivors * rate
        const avgSurvivors = survivors - deathCount / 2
        totalYearsLived += avgSurvivors
        survivors -= deathCount
        if (survivors <= 0) break
    }

    return totalYearsLived / 100000
}

interface PeriodAverages {
    tfr: number | null
    lifeExpectancy: number | null
    migration: number | null
    midYear: number
}

export function calculatePeriodAverages(
    data: CountryData,
    benchmarkResults: Record<number, YearResult>,
    startYear: number,
    endYear: number
): PeriodAverages {
    let tfrSum = 0
    let tfrCount = 0
    let leSum = 0
    let leCount = 0
    let migSum = 0
    let migCount = 0

    for (let year = startYear; year <= endYear; year++) {
        const fertilityRow = data.fertility[year]
        const tfr = calculateTFRFromRaw(fertilityRow)
        if (tfr !== null) {
            tfrSum += tfr
            tfrCount += 1
        }

        const deaths = getDeathsForYear(data, year)
        const pop = benchmarkResults[year]?.population
        if (deaths && pop) {
            const le = estimateLifeExpectancy(deaths, pop.female, pop.male)
            leSum += le
            leCount += 1
        }

        const migRate = getMigrationRateForYear(data, year)
        if (migRate !== undefined && migRate !== null) {
            migSum += migRate
            migCount += 1
        }
    }

    return {
        tfr: tfrCount > 0 ? tfrSum / tfrCount : null,
        lifeExpectancy: leCount > 0 ? leSum / leCount : null,
        migration: migCount > 0 ? migSum / migCount : null,
        midYear: (startYear + endYear) / 2,
    }
}

export function calculateTrendProjections(
    data: CountryData,
    benchmarkResults: Record<number, YearResult>,
    constants: ScenarioConstants
): ScenarioParams {
    const early = calculatePeriodAverages(
        data,
        benchmarkResults,
        constants.TREND_EARLY_START,
        constants.TREND_EARLY_END
    )
    const late = calculatePeriodAverages(
        data,
        benchmarkResults,
        constants.TREND_LATE_START,
        constants.TREND_LATE_END
    )
    const lastDecade = calculatePeriodAverages(
        data,
        benchmarkResults,
        constants.HISTORICAL_END_YEAR - 9,
        constants.HISTORICAL_END_YEAR
    )

    const yearSpan = late.midYear - early.midYear
    const leSlope =
        yearSpan !== 0
            ? ((late.lifeExpectancy || 0) - (early.lifeExpectancy || 0)) /
              yearSpan
            : 0

    const projections: ScenarioParams = {
        tfr: {},
        lifeExpectancy: {},
        migration: {},
    }

    for (const year of constants.CONTROL_YEARS) {
        const yearsFromLate = year - late.midYear
        projections.tfr[year] = lastDecade.tfr || 0
        projections.lifeExpectancy[year] = Math.max(
            30,
            Math.min(95, (late.lifeExpectancy || 0) + leSlope * yearsFromLate)
        )
        projections.migration[year] = lastDecade.migration || 0
    }

    return projections
}

export function calculateDefaultScenario(
    data: CountryData,
    benchmarkResults: Record<number, YearResult>,
    constants: ScenarioConstants
): ScenarioParams {
    return calculateTrendProjections(data, benchmarkResults, constants)
}

export function calculateUNWPPScenario(
    data: CountryData,
    benchmarkResults: Record<number, YearResult>,
    constants: ScenarioConstants
): ScenarioParams {
    const projections: ScenarioParams = {
        tfr: {},
        lifeExpectancy: {},
        migration: {},
    }

    for (const year of constants.CONTROL_YEARS) {
        const fertility = getProjectionFertilityForYear(data, year)
        if (fertility) {
            projections.tfr[year] = calculateTFR(fertility)
        } else {
            const lastDecade = calculatePeriodAverages(
                data,
                benchmarkResults,
                constants.HISTORICAL_END_YEAR - 9,
                constants.HISTORICAL_END_YEAR
            )
            projections.tfr[year] = lastDecade.tfr || 0
        }

        const deaths = getProjectionDeathsForYear(data, year)
        const projPop = getProjectionPopulationForYear(data, year)
        if (deaths && projPop) {
            projections.lifeExpectancy[year] = estimateLifeExpectancy(
                deaths,
                projPop.female,
                projPop.male
            )
        } else {
            const early = calculatePeriodAverages(
                data,
                benchmarkResults,
                constants.TREND_EARLY_START,
                constants.TREND_EARLY_END
            )
            const late = calculatePeriodAverages(
                data,
                benchmarkResults,
                constants.TREND_LATE_START,
                constants.TREND_LATE_END
            )
            const yearSpan = late.midYear - early.midYear
            const leSlope =
                yearSpan !== 0
                    ? ((late.lifeExpectancy || 0) -
                          (early.lifeExpectancy || 0)) /
                      yearSpan
                    : 0
            projections.lifeExpectancy[year] =
                (late.lifeExpectancy || 0) + leSlope * (year - late.midYear)
        }

        let migSum = 0
        let migCount = 0
        for (let y = year - 1; y <= year + 1; y++) {
            const rate = getProjectionMigrationRateForYear(data, y)
            if (rate !== undefined && rate !== null) {
                migSum += rate
                migCount += 1
            }
        }
        projections.migration[year] = migCount > 0 ? migSum / migCount : 0
    }

    return projections
}

export function calculateFullTrendScenario(
    data: CountryData,
    benchmarkResults: Record<number, YearResult>,
    constants: ScenarioConstants
): ScenarioParams {
    const early = calculatePeriodAverages(
        data,
        benchmarkResults,
        constants.TREND_EARLY_START,
        constants.TREND_EARLY_END
    )
    const late = calculatePeriodAverages(
        data,
        benchmarkResults,
        constants.TREND_LATE_START,
        constants.TREND_LATE_END
    )

    const yearSpan = late.midYear - early.midYear
    const tfrSlope =
        yearSpan !== 0 ? ((late.tfr || 0) - (early.tfr || 0)) / yearSpan : 0
    const leSlope =
        yearSpan !== 0
            ? ((late.lifeExpectancy || 0) - (early.lifeExpectancy || 0)) /
              yearSpan
            : 0
    const migSlope =
        yearSpan !== 0
            ? ((late.migration || 0) - (early.migration || 0)) / yearSpan
            : 0

    const projections: ScenarioParams = {
        tfr: {},
        lifeExpectancy: {},
        migration: {},
    }

    for (const year of constants.CONTROL_YEARS) {
        const yearsFromLate = year - late.midYear
        projections.tfr[year] = Math.max(
            0.5,
            Math.min(5.0, (late.tfr || 0) + tfrSlope * yearsFromLate)
        )
        projections.lifeExpectancy[year] = Math.max(
            30,
            Math.min(95, (late.lifeExpectancy || 0) + leSlope * yearsFromLate)
        )
        projections.migration[year] = Math.max(
            -20,
            Math.min(20, (late.migration || 0) + migSlope * yearsFromLate)
        )
    }

    return projections
}
