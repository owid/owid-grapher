/**
 * Projection execution helpers.
 */

import {
    simulateYear,
    clonePopulation,
    getTotalPopulationFromArrays,
    scaleFertilityToTFR,
    scaleMortalityToLE,
    type BaselineParams,
    type YearResult,
} from "./model"
import { getPopulationForYear, groupByAgeRange } from "../helpers/utils"
import type { CountryData, PopulationBySex } from "../helpers/types"
import type { ScenarioParams } from "./scenarios"
import {
    START_YEAR,
    HISTORICAL_END_YEAR,
    END_YEAR,
    PYRAMID_AGE_GROUPS,
} from "../helpers/constants"

function getInterpolatedValue(
    points: Record<number, number>,
    year: number,
    historicalEndYear: number,
    controlYears: readonly number[]
): number {
    if (year <= historicalEndYear) {
        return points[controlYears[0]]
    }

    let prevYear = historicalEndYear
    let prevValue = points[controlYears[0]]
    let nextYear = controlYears[0]
    let nextValue = points[controlYears[0]]

    for (let i = 0; i < controlYears.length; i++) {
        if (year <= controlYears[i]) {
            nextYear = controlYears[i]
            nextValue = points[controlYears[i]]
            if (i > 0) {
                prevYear = controlYears[i - 1]
                prevValue = points[controlYears[i - 1]]
            }
            break
        }
        prevYear = controlYears[i]
        prevValue = points[controlYears[i]]
    }

    if (year >= controlYears[controlYears.length - 1]) {
        return points[controlYears[controlYears.length - 1]]
    }

    const t = (year - prevYear) / (nextYear - prevYear)
    return prevValue + t * (nextValue - prevValue)
}

function getYearlyParameters({
    scenarioParams,
    baselineParams,
    nextYear,
    historicalEndYear,
    controlYears,
}: {
    scenarioParams: ScenarioParams
    baselineParams: BaselineParams
    nextYear: number
    historicalEndYear: number
    controlYears: readonly number[]
}) {
    const targetTFR = getInterpolatedValue(
        scenarioParams.fertilityRate,
        nextYear,
        historicalEndYear,
        controlYears
    )
    const targetLE = getInterpolatedValue(
        scenarioParams.lifeExpectancy,
        nextYear,
        historicalEndYear,
        controlYears
    )
    const migrationRate = getInterpolatedValue(
        scenarioParams.netMigrationRate,
        nextYear,
        historicalEndYear,
        controlYears
    )

    const fertilityRates = scaleFertilityToTFR(
        baselineParams.fertility,
        baselineParams.tfr,
        targetTFR
    )
    const mortalityRates = scaleMortalityToLE(
        baselineParams.mortality,
        baselineParams.lifeExpectancy,
        targetLE
    )

    return { fertilityRates, mortalityRates, migrationRate }
}

export function runProjectionResults({
    startPopulation,
    baselineParams,
    scenarioParams,
    historicalEndYear,
    endYear,
    controlYears,
}: {
    startPopulation: PopulationBySex
    baselineParams: BaselineParams
    scenarioParams: ScenarioParams
    historicalEndYear: number
    endYear: number
    controlYears: readonly number[]
}): Record<number, YearResult> {
    let population = clonePopulation(startPopulation)
    const results: Record<number, YearResult> = {
        [historicalEndYear]: {
            population: clonePopulation(population),
            totalPop: getTotalPopulationFromArrays(
                population.female,
                population.male
            ),
        },
    }

    for (let year = historicalEndYear; year < endYear; year++) {
        const nextYear = year + 1
        const { fertilityRates, mortalityRates, migrationRate } =
            getYearlyParameters({
                scenarioParams,
                baselineParams,
                nextYear,
                historicalEndYear,
                controlYears,
            })

        population = simulateYear(
            population,
            mortalityRates,
            fertilityRates,
            migrationRate
        )
        results[nextYear] = {
            population: clonePopulation(population),
            totalPop: getTotalPopulationFromArrays(
                population.female,
                population.male
            ),
        }
    }

    return results
}

export function runProjectionFinalPopulation({
    startPopulation,
    baselineParams,
    scenarioParams,
    historicalEndYear,
    endYear,
    controlYears,
}: {
    startPopulation: PopulationBySex
    baselineParams: BaselineParams
    scenarioParams: ScenarioParams
    historicalEndYear: number
    endYear: number
    controlYears: readonly number[]
}): number {
    let population = clonePopulation(startPopulation)

    for (let year = historicalEndYear; year < endYear; year++) {
        const nextYear = year + 1
        const { fertilityRates, mortalityRates, migrationRate } =
            getYearlyParameters({
                scenarioParams,
                baselineParams,
                nextYear,
                historicalEndYear,
                controlYears,
            })
        population = simulateYear(
            population,
            mortalityRates,
            fertilityRates,
            migrationRate
        )
    }

    return getTotalPopulationFromArrays(population.female, population.male)
}

export function runProjectionTrajectory({
    startPopulation,
    baselineParams,
    scenarioParams,
    historicalEndYear,
    endYear,
    controlYears,
}: {
    startPopulation: PopulationBySex
    baselineParams: BaselineParams
    scenarioParams: ScenarioParams
    historicalEndYear: number
    endYear: number
    controlYears: readonly number[]
}): Record<number, number> {
    let population = clonePopulation(startPopulation)
    const trajectory: Record<number, number> = {
        [historicalEndYear]: getTotalPopulationFromArrays(
            population.female,
            population.male
        ),
    }

    for (let year = historicalEndYear; year < endYear; year++) {
        const nextYear = year + 1
        const { fertilityRates, mortalityRates, migrationRate } =
            getYearlyParameters({
                scenarioParams,
                baselineParams,
                nextYear,
                historicalEndYear,
                controlYears,
            })

        population = simulateYear(
            population,
            mortalityRates,
            fertilityRates,
            migrationRate
        )
        trajectory[nextYear] = getTotalPopulationFromArrays(
            population.female,
            population.male
        )
    }

    return trajectory
}

export function computeMaxAgeGroupPopulation(simulation: {
    data: CountryData
    forecastResults: Record<number, YearResult> | null
}): number {
    const { data, forecastResults } = simulation
    let maxVal = 0

    for (let year = START_YEAR; year <= HISTORICAL_END_YEAR; year++) {
        const pop = getPopulationForYear(data, year)
        if (!pop) continue
        const maleGroups = groupByAgeRange(pop.male)
        const femaleGroups = groupByAgeRange(pop.female)
        for (const g of PYRAMID_AGE_GROUPS) {
            maxVal = Math.max(maxVal, maleGroups[g] || 0, femaleGroups[g] || 0)
        }
    }

    if (forecastResults) {
        for (let year = HISTORICAL_END_YEAR + 1; year <= END_YEAR; year++) {
            const pop = forecastResults[year]?.population
            if (!pop) continue
            const maleGroups = groupByAgeRange(pop.male)
            const femaleGroups = groupByAgeRange(pop.female)
            for (const g of PYRAMID_AGE_GROUPS) {
                maxVal = Math.max(
                    maxVal,
                    maleGroups[g] || 0,
                    femaleGroups[g] || 0
                )
            }
        }
    }

    return Math.ceil(maxVal * 1.1)
}

/**
 * Like computeMaxAgeGroupPopulation, but sums male + female for each age group.
 */
export function computeMaxTotalAgeGroupPopulation(simulation: {
    data: CountryData
    forecastResults: Record<number, YearResult> | null
}): number {
    const { data, forecastResults } = simulation
    let maxVal = 0

    const updateMax = (pop: PopulationBySex) => {
        const maleGroups = groupByAgeRange(pop.male)
        const femaleGroups = groupByAgeRange(pop.female)
        for (const g of PYRAMID_AGE_GROUPS) {
            maxVal = Math.max(
                maxVal,
                (maleGroups[g] || 0) + (femaleGroups[g] || 0)
            )
        }
    }

    for (let year = START_YEAR; year <= HISTORICAL_END_YEAR; year++) {
        const pop = getPopulationForYear(data, year)
        if (pop) updateMax(pop)
    }

    if (forecastResults) {
        for (let year = HISTORICAL_END_YEAR + 1; year <= END_YEAR; year++) {
            const pop = forecastResults[year]?.population
            if (pop) updateMax(pop)
        }
    }

    return Math.ceil(maxVal * 1.1)
}

export { getInterpolatedValue }
