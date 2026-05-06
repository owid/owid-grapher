/**
 * Hook that runs the simulation pipeline when data or country changes.
 * Returns all derived state needed by the UI.
 */

import { useMemo, useState, useCallback } from "react"
import type {
    CountryData,
    ParameterKey,
    PopulationBySex,
    PopulationByAgeZone,
} from "./types"
import { PARAMETER_KEYS } from "./types"
import {
    getPopulationForYear,
    getDeathsForYear,
    getMigrationRateForYear,
} from "./utils"
import {
    MAX_AGE,
    START_YEAR,
    HISTORICAL_END_YEAR,
    END_YEAR,
    BASELINE_START_YEAR,
    CONTROL_YEARS,
    TREND_EARLY_START,
    TREND_EARLY_END,
    TREND_LATE_START,
    TREND_LATE_END,
    RETIREMENT_AGE,
} from "./constants"
import {
    runHistoricalProjection,
    calculateBaselineRates,
    runUNWPPScenarioProjection,
    optimizeMigrationOptions,
    setMigrationOptions,
    DEFAULT_MIGRATION_OPTIONS,
    getTotalPopulationFromArrays,
    type BaselineParams,
    type YearResult,
} from "../model/model"
import {
    calculateUNWPPScenario,
    calculateTFRFromRaw,
    estimateLifeExpectancy,
    type ScenarioParams,
    type ScenarioConstants,
} from "../model/scenarios"
import { runProjectionResults } from "../model/projectionRunner"

const SCENARIO_CONSTANTS: ScenarioConstants = {
    HISTORICAL_END_YEAR,
    CONTROL_YEARS,
    TREND_EARLY_START,
    TREND_EARLY_END,
    TREND_LATE_START,
    TREND_LATE_END,
}

export interface Simulation {
    data: CountryData
    benchmarkResults: Record<number, YearResult>
    forecastResults: Record<number, YearResult>
    unwppBenchmarkResults: Record<number, YearResult>
    unwppScenarioParams: ScenarioParams
    baselineParams: BaselineParams
    initialScenarioParams: ScenarioParams
    scenarioParams: ScenarioParams
    isModified: boolean
    modifiedParameters: Set<ParameterKey>
    setScenarioParams: (params: ScenarioParams) => void
    getPopulationForYear: (year: number) => PopulationBySex | null
    getBenchmarkPopulationForYear: (year: number) => PopulationBySex | null
    getStatsForYear: (year: number) => {
        totalPopulation: number
        medianAge: number
        dependencyRatio: number
    } | null
    getAgeZonePopulation: (year: number) => PopulationByAgeZone
    getBenchmarkAgeZonePopulation: (year: number) => PopulationByAgeZone
}

function ageZoneFromPopulation(
    pop: PopulationBySex | null
): PopulationByAgeZone {
    if (!pop) return { young: 0, working: 0, old: 0 }
    const breakdown = calculateDependencyRatio(pop, RETIREMENT_AGE, true) as {
        young: number
        workingAge: number
        old: number
    }
    return {
        young: breakdown.young,
        working: breakdown.workingAge,
        old: breakdown.old,
    }
}

function calculateMedianAge(population: PopulationBySex): number {
    const total = getTotalPopulationFromArrays(
        population.female,
        population.male
    )
    let cumulative = 0
    const halfTotal = total / 2

    for (let age = 0; age <= MAX_AGE; age++) {
        cumulative +=
            (population.female[age] || 0) + (population.male[age] || 0)
        if (cumulative >= halfTotal) return age
    }
    return 50
}

/**
 * Calculate dependency ratio from population
 * Dependency ratio = (pop under 15 + pop at/above retirement age) / pop 15 to (retirement age - 1)
 * Returned as percentage (e.g., 52 means 52 dependents per 100 working-age people)
 */
function calculateDependencyRatio(
    population: PopulationBySex,
    upperAge = RETIREMENT_AGE,
    returnBreakdown: boolean = false
):
    | number
    | {
          ratio: number
          young: number
          workingAge: number
          old: number
          total: number
          youngPct: number
          workingPct: number
          oldPct: number
      } {
    let young = 0 // 0-14
    let workingAge = 0 // 15 to (upperAge - 1)
    let old = 0 // upperAge+

    for (let age = 0; age <= MAX_AGE; age++) {
        const pop = (population.female[age] || 0) + (population.male[age] || 0)
        if (age < 15) {
            young += pop
        } else if (age < upperAge) {
            workingAge += pop
        } else {
            old += pop
        }
    }

    const ratio =
        workingAge === 0 ? 0 : Math.round(((young + old) / workingAge) * 100)

    if (returnBreakdown) {
        const total = young + workingAge + old
        return {
            ratio,
            young,
            workingAge,
            old,
            total,
            youngPct: total > 0 ? (young / total) * 100 : 0,
            workingPct: total > 0 ? (workingAge / total) * 100 : 0,
            oldPct: total > 0 ? (old / total) * 100 : 0,
        }
    }
    return ratio
}

/**
 * Compute scenario overrides from config options.
 * Pure function — no hooks, no side effects.
 */
export function computeScenarioOverrides(opts: {
    fertilityRateAssumptions?: Record<number, number>
    lifeExpectancyAssumptions?: Record<number, number>
    netMigrationRateAssumptions?: Record<number, number>
}): Partial<ScenarioParams> | undefined {
    const hasCustom =
        opts.fertilityRateAssumptions !== undefined ||
        opts.lifeExpectancyAssumptions !== undefined ||
        opts.netMigrationRateAssumptions !== undefined
    if (hasCustom) {
        return {
            fertilityRate: opts.fertilityRateAssumptions,
            lifeExpectancy: opts.lifeExpectancyAssumptions,
            netMigrationRate: opts.netMigrationRateAssumptions,
        }
    }
    return undefined
}

export function useSimulation(
    data: CountryData,
    initialScenarioOverrides?: Partial<ScenarioParams>
): Simulation | null {
    const [scenarioParams, setScenarioParamsRaw] =
        useState<ScenarioParams | null>(null)

    const country = data.country

    // Core simulation results (recomputed when data changes)
    const core = useMemo(() => {
        if (!data) return null

        // Calibrate migration
        const optimized = optimizeMigrationOptions(
            data,
            country,
            HISTORICAL_END_YEAR - 14,
            HISTORICAL_END_YEAR
        )
        setMigrationOptions(optimized.options)

        // Historical benchmark with stable defaults
        const benchmarkResults = runHistoricalProjection(
            data,
            START_YEAR,
            HISTORICAL_END_YEAR,
            { migrationOptions: { ...DEFAULT_MIGRATION_OPTIONS } }
        )

        // Baseline from last 20 years
        const baselineParams = calculateBaselineRates(
            data,
            BASELINE_START_YEAR,
            HISTORICAL_END_YEAR,
            benchmarkResults
        )

        // UN WPP scenario benchmark
        const actualStartPop = getPopulationForYear(data, HISTORICAL_END_YEAR)!
        const unwppBenchmarkResults = runUNWPPScenarioProjection(
            data,
            actualStartPop,
            HISTORICAL_END_YEAR,
            END_YEAR
        )

        // Default scenario: UN WPP Medium
        const defaultScenario = calculateUNWPPScenario(
            data,
            benchmarkResults,
            SCENARIO_CONSTANTS
        )

        // Compute historical anchor values at HISTORICAL_END_YEAR for smooth interpolation
        const anchorTFR =
            calculateTFRFromRaw(data.fertility[HISTORICAL_END_YEAR]) ??
            baselineParams.tfr
        const anchorMig =
            getMigrationRateForYear(data, HISTORICAL_END_YEAR) ?? 0
        const deaths2023 = getDeathsForYear(data, HISTORICAL_END_YEAR)
        const pop2023 = benchmarkResults[HISTORICAL_END_YEAR]?.population
        const anchorLE =
            deaths2023 && pop2023
                ? estimateLifeExpectancy(
                      deaths2023,
                      pop2023.female,
                      pop2023.male
                  )
                : baselineParams.lifeExpectancy

        return {
            benchmarkResults,
            baselineParams,
            unwppBenchmarkResults,
            defaultScenario,
            historicalAnchors: {
                fertilityRate: anchorTFR,
                lifeExpectancy: anchorLE,
                netMigrationRate: anchorMig,
            },
        }
    }, [data, country])

    // Snapshot of scenario params before any user modification. Merges initial
    // overrides with defaults at both the parameter level (fertility vs life
    // expectancy vs migration) and the control-year level, so that partial
    // overrides like { 2100: 1.5 } fill missing years from the UN WPP.
    const initialScenarioParams = useMemo(() => {
        if (!core) return null
        if (initialScenarioOverrides) {
            return {
                fertilityRate: {
                    ...core.defaultScenario.fertilityRate,
                    ...initialScenarioOverrides.fertilityRate,
                },
                lifeExpectancy: {
                    ...core.defaultScenario.lifeExpectancy,
                    ...initialScenarioOverrides.lifeExpectancy,
                },
                netMigrationRate: {
                    ...core.defaultScenario.netMigrationRate,
                    ...initialScenarioOverrides.netMigrationRate,
                },
            }
        }
        return core.defaultScenario
    }, [core, initialScenarioOverrides])

    const effectiveScenarioParams = useMemo(
        () => scenarioParams ?? initialScenarioParams,
        [scenarioParams, initialScenarioParams]
    )

    // Forecast results (recomputed when scenario changes)
    const forecastResults = useMemo(() => {
        if (!data || !core || !effectiveScenarioParams) return null

        const actualStartPop = getPopulationForYear(data, HISTORICAL_END_YEAR)
        if (!actualStartPop) return null

        // Augment scenario params with historical anchor for smooth interpolation
        // between HISTORICAL_END_YEAR and first control year
        const { historicalAnchors } = core
        const augmentedParams: ScenarioParams = {
            fertilityRate: {
                [HISTORICAL_END_YEAR]: historicalAnchors.fertilityRate,
                ...effectiveScenarioParams.fertilityRate,
            },
            lifeExpectancy: {
                [HISTORICAL_END_YEAR]: historicalAnchors.lifeExpectancy,
                ...effectiveScenarioParams.lifeExpectancy,
            },
            netMigrationRate: {
                [HISTORICAL_END_YEAR]: historicalAnchors.netMigrationRate,
                ...effectiveScenarioParams.netMigrationRate,
            },
        }
        const augmentedControlYears = [
            HISTORICAL_END_YEAR,
            ...CONTROL_YEARS,
        ] as const

        return runProjectionResults({
            startPopulation: actualStartPop,
            baselineParams: core.baselineParams,
            scenarioParams: augmentedParams,
            historicalEndYear: HISTORICAL_END_YEAR,
            endYear: END_YEAR,
            controlYears: augmentedControlYears,
        })
    }, [data, core, effectiveScenarioParams])

    const setScenarioParams = useCallback((params: ScenarioParams) => {
        setScenarioParamsRaw(params)
    }, [])

    // Reset scenario when country/overrides change
    useMemo(() => {
        if (core) {
            setScenarioParamsRaw(null)
        }
    }, [core])

    const getPopForYear = useCallback(
        (year: number): PopulationBySex | null => {
            if (!data || !forecastResults) return null
            if (year <= HISTORICAL_END_YEAR) {
                return getPopulationForYear(data, year)
            }
            return forecastResults[year]?.population ?? null
        },
        [data, forecastResults]
    )

    const getStatsForYear = useCallback(
        (year: number) => {
            const pop = getPopForYear(year)
            if (!pop) return null

            return {
                totalPopulation: getTotalPopulationFromArrays(
                    pop.female,
                    pop.male
                ),
                medianAge: calculateMedianAge(pop),
                dependencyRatio: calculateDependencyRatio(pop) as number,
            }
        },
        [getPopForYear]
    )

    const getAgeZonePopulation = useCallback(
        (year: number): PopulationByAgeZone => {
            const pop = getPopForYear(year)
            return ageZoneFromPopulation(pop)
        },
        [getPopForYear]
    )

    const getBenchmarkPopForYear = useCallback(
        (year: number): PopulationBySex | null => {
            if (!data || !core) return null
            if (year <= HISTORICAL_END_YEAR) {
                return getPopulationForYear(data, year)
            }
            return core.unwppBenchmarkResults[year]?.population ?? null
        },
        [data, core]
    )

    const getBenchmarkAgeZonePopulation = useCallback(
        (year: number): PopulationByAgeZone => {
            const pop = getBenchmarkPopForYear(year)
            return ageZoneFromPopulation(pop)
        },
        [getBenchmarkPopForYear]
    )

    const modifiedParameters = useMemo(() => {
        const modified = new Set<ParameterKey>()
        if (!core || !effectiveScenarioParams) return modified
        const un = core.defaultScenario
        for (const key of PARAMETER_KEYS) {
            const isModified = CONTROL_YEARS.some(
                (y) =>
                    Math.abs(effectiveScenarioParams[key][y] - un[key][y]) >=
                    0.01
            )
            if (isModified) modified.add(key)
        }
        return modified
    }, [core, effectiveScenarioParams])

    const isModified = modifiedParameters.size > 0

    if (
        !data ||
        !core ||
        !initialScenarioParams ||
        !effectiveScenarioParams ||
        !forecastResults
    )
        return null

    return {
        data,
        benchmarkResults: core.benchmarkResults,
        forecastResults,
        unwppBenchmarkResults: core.unwppBenchmarkResults,
        unwppScenarioParams: core.defaultScenario,
        baselineParams: core.baselineParams,
        initialScenarioParams,
        scenarioParams: effectiveScenarioParams,
        isModified,
        modifiedParameters,
        setScenarioParams,
        getPopulationForYear: getPopForYear,
        getBenchmarkPopulationForYear: getBenchmarkPopForYear,
        getStatsForYear,
        getAgeZonePopulation,
        getBenchmarkAgeZonePopulation,
    }
}
