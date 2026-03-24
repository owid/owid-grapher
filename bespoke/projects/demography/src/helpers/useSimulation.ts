/**
 * Hook that runs the simulation pipeline when data or country changes.
 * Returns all derived state needed by the UI.
 */

import { useMemo, useState, useCallback } from "react"
import type { CountryData, PopulationBySex, PopulationByAgeZone } from "./types"
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
    calculateDefaultScenario,
    calculateFullTrendScenario,
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

export type PresetName = "unwpp" | "constant" | "trend"

export interface Simulation {
    data: CountryData
    benchmarkResults: Record<number, YearResult>
    forecastResults: Record<number, YearResult>
    unwppBenchmarkResults: Record<number, YearResult>
    unwppScenarioParams: ScenarioParams
    baselineParams: BaselineParams
    scenarioParams: ScenarioParams
    activePreset: PresetName | null
    applyPreset: (preset: PresetName) => void
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

export function useSimulation(
    data: CountryData,
    initialScenarioOverrides?: Partial<ScenarioParams>
): Simulation | null {
    const [scenarioParams, setScenarioParamsRaw] =
        useState<ScenarioParams | null>(null)
    const [activePreset, setActivePreset] = useState<PresetName | null>("unwpp")

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

    // Set default scenario when core changes
    const effectiveScenarioParams = useMemo(() => {
        if (!core) return null
        if (scenarioParams) return scenarioParams
        // Merge initial overrides with defaults
        if (initialScenarioOverrides) {
            return {
                fertilityRate:
                    initialScenarioOverrides.fertilityRate ??
                    core.defaultScenario.fertilityRate,
                lifeExpectancy:
                    initialScenarioOverrides.lifeExpectancy ??
                    core.defaultScenario.lifeExpectancy,
                netMigrationRate:
                    initialScenarioOverrides.netMigrationRate ??
                    core.defaultScenario.netMigrationRate,
            }
        }
        return core.defaultScenario
    }, [core, scenarioParams, initialScenarioOverrides])

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

    const applyPreset = useCallback(
        (preset: PresetName) => {
            if (!data || !core) return
            setActivePreset(preset)

            let params: ScenarioParams
            switch (preset) {
                case "unwpp":
                    params = calculateUNWPPScenario(
                        data,
                        core.benchmarkResults,
                        SCENARIO_CONSTANTS
                    )
                    break
                case "constant":
                    params = calculateDefaultScenario(
                        data,
                        core.benchmarkResults,
                        SCENARIO_CONSTANTS
                    )
                    break
                case "trend":
                    params = calculateFullTrendScenario(
                        data,
                        core.benchmarkResults,
                        SCENARIO_CONSTANTS
                    )
                    break
            }
            setScenarioParamsRaw(params)
        },
        [data, core]
    )

    const setScenarioParams = useCallback(
        (params: ScenarioParams) => {
            setScenarioParamsRaw(params)
            // Check if params match UN WPP to restore preset indicator
            if (core) {
                const un = core.defaultScenario
                const matches = CONTROL_YEARS.every(
                    (y) =>
                        Math.abs(
                            params.fertilityRate[y] - un.fertilityRate[y]
                        ) < 0.01 &&
                        Math.abs(
                            params.lifeExpectancy[y] - un.lifeExpectancy[y]
                        ) < 0.01 &&
                        Math.abs(
                            params.netMigrationRate[y] - un.netMigrationRate[y]
                        ) < 0.01
                )
                setActivePreset(matches ? "unwpp" : null)
            } else {
                setActivePreset(null)
            }
        },
        [core]
    )

    // Reset scenario when country changes
    useMemo(() => {
        if (core) {
            setScenarioParamsRaw(null)
            setActivePreset("unwpp")
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

    if (!data || !core || !effectiveScenarioParams || !forecastResults)
        return null

    return {
        data,
        benchmarkResults: core.benchmarkResults,
        forecastResults,
        unwppBenchmarkResults: core.unwppBenchmarkResults,
        unwppScenarioParams: core.defaultScenario,
        baselineParams: core.baselineParams,
        scenarioParams: effectiveScenarioParams,
        activePreset,
        applyPreset,
        setScenarioParams,
        getPopulationForYear: getPopForYear,
        getBenchmarkPopulationForYear: getBenchmarkPopForYear,
        getStatsForYear,
        getAgeZonePopulation,
        getBenchmarkAgeZonePopulation,
    }
}
