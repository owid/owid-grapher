import * as R from "remeda"
import { formatValue } from "@ourworldindata/utils"
import { HISTORICAL_TIME_RANGE } from "./constants.js"
import {
    calculateTFRFromRaw,
    estimateLifeExpectancy,
    ScenarioParams,
} from "../model/scenarios.js"
import { Simulation } from "./useSimulation.js"
import { getDeathsForYear, getMigrationRateForYear } from "./utils.js"
import { ParameterKey } from "./types.js"

interface ParameterConfig {
    title: string
    subtitle: string
    tooltipContent: string
    paramKey: keyof ScenarioParams
    formatValue: (value: number) => string
    computeHistorical: (simulation: Simulation) => {
        points: { year: number; value: number }[]
        min: number
        max: number
    }
}

export const parameterConfigByKey: Record<ParameterKey, ParameterConfig> = {
    "fertility-rate": {
        title: "Fertility Rate",
        subtitle: "Average number of children born per woman",
        tooltipContent:
            "Average number of children a woman would have over her lifetime at current age-specific birth rates. A TFR of ~2.1 is needed to maintain population without migration.",
        paramKey: "tfr",
        formatValue: (v) =>
            formatValue(v, {
                numDecimalPlaces: 1,
                numberAbbreviation: false,
                trailingZeroes: true,
            }),
        computeHistorical: (simulation) => {
            const points = R.pipe(
                HISTORICAL_TIME_RANGE,
                R.map((year) => {
                    const tfr = calculateTFRFromRaw(
                        simulation.data.fertility[year]
                    )
                    if (tfr === null) return undefined
                    return { year, value: tfr }
                }),
                R.filter(R.isDefined)
            )

            // The y-points are draggable from 0-5 or 0-(max+1)
            const max = Math.max(4, ...points.map((d) => d.value))
            return { points, min: 0, max: Math.ceil(max + 1) }
        },
    },
    "life-expectancy": {
        title: "Life Expectancy",
        subtitle: "Average number of years a person lives",
        tooltipContent:
            "Average years a newborn would live if current age-specific mortality rates remained constant. Calculated from a period life table derived from death counts and population.",
        paramKey: "lifeExpectancy",
        formatValue: (v) =>
            formatValue(v, {
                numDecimalPlaces: 0,
                numberAbbreviation: false,
            }),
        computeHistorical: (simulation) => {
            const points = R.pipe(
                HISTORICAL_TIME_RANGE,
                R.map((year) => {
                    const deaths = getDeathsForYear(simulation.data, year)
                    const pop = simulation.benchmarkResults[year]?.population
                    if (!deaths || !pop) return undefined
                    return {
                        year,
                        value: estimateLifeExpectancy(
                            deaths,
                            pop.female,
                            pop.male
                        ),
                    }
                }),
                R.filter(R.isDefined)
            )

            // The y-points are draggable from the nearest decade (e.g. 47 -> 40) to 130
            const min = Math.min(100, ...points.map((d) => d.value))
            return { points, min: Math.floor(min / 10) * 10, max: 130 }
        },
    },
    "net-migration-rate": {
        title: "Net Migration Rate",
        subtitle: "Difference between immigration and emigration",
        tooltipContent:
            "Difference between immigration and emigration per 1,000 people. Positive values mean more people entering than leaving. Net migration is split into implied immigration and emigration flows and distributed by the migration assumptions in the details section below.",
        paramKey: "migration",
        formatValue: (v) =>
            formatValue(v, {
                numDecimalPlaces: 1,
                numberAbbreviation: false,
                showPlus: true,
                trailingZeroes: true,
            }),
        computeHistorical: (simulation) => {
            const points = R.pipe(
                HISTORICAL_TIME_RANGE,
                R.map((year) => ({
                    year,
                    value: getMigrationRateForYear(simulation.data, year),
                }))
            )
            const values = points.map((d) => d.value)

            const min = Math.min(0, ...values)
            const max = Math.max(0, ...values)

            // Round y-axis bounds to the nearest 5, with extra padding
            return {
                points,
                min: Math.floor(min / 5) * 5 - 5,
                max: Math.ceil(max / 5) * 5 + 5,
            }
        },
    },
}
