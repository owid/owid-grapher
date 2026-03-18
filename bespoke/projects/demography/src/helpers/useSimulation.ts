/**
 * Hook that runs the simulation pipeline when data or country changes.
 * Returns all derived state needed by the UI.
 */

import { useMemo, useState, useCallback } from "react"
import type { CountryData, PopulationBySex } from "./types"
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
    getStatsForYear: (year: number) => {
        totalPopulation: number
        medianAge: number
        dependencyRatio: number
    } | null
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

function calculateDependencyRatio(
    population: PopulationBySex,
    retirementAge = 65
): number {
    let working = 0
    let dependents = 0

    for (let age = 0; age <= MAX_AGE; age++) {
        const count =
            (population.female[age] || 0) + (population.male[age] || 0)
        if (age >= 15 && age < retirementAge) {
            working += count
        } else {
            dependents += count
        }
    }

    return working > 0 ? dependents / working : 0
}

export function useSimulation(data: CountryData): Simulation | null {
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
                tfr: anchorTFR,
                lifeExpectancy: anchorLE,
                migration: anchorMig,
            },
        }
    }, [data, country])

    // Set default scenario when core changes
    const effectiveScenarioParams = useMemo(() => {
        if (!core) return null
        return scenarioParams ?? core.defaultScenario
    }, [core, scenarioParams])

    // Forecast results (recomputed when scenario changes)
    const forecastResults = useMemo(() => {
        if (!data || !core || !effectiveScenarioParams) return null

        const actualStartPop = getPopulationForYear(data, HISTORICAL_END_YEAR)
        if (!actualStartPop) return null

        // Augment scenario params with historical anchor for smooth interpolation
        // between HISTORICAL_END_YEAR and first control year
        const { historicalAnchors } = core
        const augmentedParams: ScenarioParams = {
            tfr: {
                [HISTORICAL_END_YEAR]: historicalAnchors.tfr,
                ...effectiveScenarioParams.tfr,
            },
            lifeExpectancy: {
                [HISTORICAL_END_YEAR]: historicalAnchors.lifeExpectancy,
                ...effectiveScenarioParams.lifeExpectancy,
            },
            migration: {
                [HISTORICAL_END_YEAR]: historicalAnchors.migration,
                ...effectiveScenarioParams.migration,
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
                        Math.abs(params.tfr[y] - un.tfr[y]) < 0.01 &&
                        Math.abs(
                            params.lifeExpectancy[y] - un.lifeExpectancy[y]
                        ) < 0.01 &&
                        Math.abs(params.migration[y] - un.migration[y]) < 0.01
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
                dependencyRatio: calculateDependencyRatio(pop),
            }
        },
        [getPopForYear]
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
        getStatsForYear,
    }
}
