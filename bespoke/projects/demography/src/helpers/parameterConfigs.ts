import * as R from "remeda"
import { formatValue, getRegionByName } from "@ourworldindata/utils"
import { HISTORICAL_TIME_RANGE } from "./constants.js"
import {
    calculateTFRFromRaw,
    estimateLifeExpectancy,
} from "../model/scenarios.js"
import { Simulation } from "./useSimulation.js"
import { getDeathsForYear, getMigrationRateForYear } from "./utils.js"
import { ParameterKey } from "./types.js"

interface ParameterConfig {
    title: string
    subtitle: (entityName: string) => string
    tooltipContent: string
    formatValue: (value: number) => string
    computeHistorical: (
        simulation: Simulation,
        interactive?: boolean
    ) => {
        points: { year: number; value: number }[]
        min: number
        max: number
    }
}

export const parameterConfigByKey: Record<ParameterKey, ParameterConfig> = {
    fertilityRate: {
        title: "Fertility Rate",
        subtitle: () => "Average number of births per woman",
        tooltipContent:
            "Total fertility rate is the number of births a woman would have, if she experienced the birth rates of women of each age group in one particular year across her childbearing years.",
        formatValue: (v) =>
            formatValue(v, {
                numDecimalPlaces: 1,
                numberAbbreviation: false,
                trailingZeroes: true,
            }),
        computeHistorical: (simulation, interactive = true) => {
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

            if (interactive) {
                // The y-points are draggable from 0-5 or 0-(max+1)
                const max = Math.max(4, ...points.map((d) => d.value))
                return { points, min: 0, max: Math.ceil(max + 1) }
            } else {
                const max = Math.max(3, ...points.map((d) => d.value))
                return { points, min: 0, max: Math.ceil(max) + 0.5 }
            }
        },
    },
    lifeExpectancy: {
        title: "Life expectancy at birth",
        subtitle: () =>
            "Years a newborn is expected to live, given current mortality rates",
        tooltipContent:
            "Period life expectancy is the number of years the average person born in a certain year would live if they experienced the same chances of dying at each age as people did that year.",
        formatValue: (v) =>
            formatValue(v, {
                numDecimalPlaces: 0,
                numberAbbreviation: false,
            }),
        computeHistorical: (simulation, interactive = true) => {
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

            const values = points.map((d) => d.value)
            if (interactive) {
                // The y-points are draggable from the nearest decade (e.g. 47 -> 40) to 130
                const min = Math.min(100, ...values)
                return { points, min: Math.floor(min / 10) * 10, max: 130 }
            } else {
                const min = Math.min(...values)
                const max = Math.max(...values)
                return {
                    points,
                    min: Math.floor(min / 5) * 5,
                    max: Math.ceil(max / 5) * 5 + 5,
                }
            }
        },
    },
    netMigrationRate: {
        title: "Net Migration Rate",
        subtitle: (entityName: string) => {
            if (entityName === "World") return "Not applicable"
            const region = getRegionByName(entityName)
            if (region?.regionType === "aggregate")
                return "Difference between people entering and leaving the continent"
            return "Difference between people entering and leaving the country"
        },
        tooltipContent:
            "Net migration is the difference in immigration (people entering the country) and emigration (people leaving). This number is positive if more people are entering than leaving. This difference is given as a percentage of the total population.",
        formatValue: (v) =>
            formatValue(v, {
                numDecimalPlaces: 1,
                numberAbbreviation: false,
                showPlus: true,
                trailingZeroes: true,
            }),
        computeHistorical: (simulation, interactive = true) => {
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

            const extra = interactive ? 5 : 0
            return {
                points,
                min: Math.floor(min / 5) * 5 - extra,
                max: Math.ceil(max / 5) * 5 + extra,
            }
        },
    },
}
