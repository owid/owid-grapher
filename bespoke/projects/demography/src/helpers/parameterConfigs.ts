import * as R from "remeda"
import { formatValue, getRegionByName } from "@ourworldindata/utils"
import { HISTORICAL_TIME_RANGE, PROJECTION_TIME_RANGE } from "./constants.js"
import {
    calculateTFRFromRaw,
    estimateLifeExpectancy,
} from "../model/scenarios.js"
import {
    getProjectionFertilityForYear,
    getProjectionDeathsForYear,
    getProjectionMigrationRateForYear,
    getProjectionPopulationForYear,
    calculateTFR,
} from "../model/model.js"
import { Simulation } from "./useSimulation.js"
import { getDeathsForYear, getMigrationRateForYear } from "./utils.js"
import { ParameterKey } from "./types.js"

interface ParameterConfig {
    shortTitle: string
    extraShortTitle: string
    title: string
    unit: string
    axisUnit: string
    yPadding: number
    yFloor?: number
    subtitle: (entityName: string) => string
    tooltipContent: string
    formatValue: (value: number) => string
    computeHistorical: (simulation: Simulation) => {
        points: { year: number; value: number }[]
        min: number
        max: number
    }
    computeUnwppProjection: (simulation: Simulation) => {
        points: { year: number; value: number }[]
    }
}

export const parameterConfigByKey: Record<ParameterKey, ParameterConfig> = {
    fertilityRate: {
        shortTitle: "Fertility",
        extraShortTitle: "Fertility",
        title: "Fertility Rate",
        unit: "births per woman",
        axisUnit: "births per woman",
        yPadding: 2,
        yFloor: 0,
        subtitle: () => "Average number of births per woman",
        tooltipContent:
            "Total fertility rate is the number of births a woman would have, if she experienced the birth rates of women of each age group in one particular year across her childbearing years.",
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

            const values = points.map((d) => d.value)
            return {
                points,
                min: Math.min(...values),
                max: Math.max(...values),
            }
        },
        computeUnwppProjection: (simulation) => {
            const points = R.pipe(
                PROJECTION_TIME_RANGE,
                R.map((year) => {
                    const fertility = getProjectionFertilityForYear(
                        simulation.data,
                        year
                    )
                    if (!fertility) return undefined
                    return { year, value: calculateTFR(fertility) }
                }),
                R.filter(R.isDefined)
            )
            return { points }
        },
    },
    lifeExpectancy: {
        shortTitle: "Life Expectancy",
        extraShortTitle: "Life Exp.",
        title: "Life Expectancy at Birth",
        unit: "years",
        axisUnit: "years",
        yPadding: 10,
        yFloor: 0,
        subtitle: () =>
            "Years a newborn is expected to live, given current mortality rates",
        tooltipContent:
            "Period life expectancy is the number of years the average person born in a certain year would live if they experienced the same chances of dying at each age as people did that year.",
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

            const values = points.map((d) => d.value)
            return {
                points,
                min: Math.min(...values),
                max: Math.max(...values),
            }
        },
        computeUnwppProjection: (simulation) => {
            const points = R.pipe(
                PROJECTION_TIME_RANGE,
                R.map((year) => {
                    const deaths = getProjectionDeathsForYear(
                        simulation.data,
                        year
                    )
                    const pop = getProjectionPopulationForYear(
                        simulation.data,
                        year
                    )
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
            return { points }
        },
    },
    netMigrationRate: {
        shortTitle: "Migration",
        extraShortTitle: "Migration",
        title: "Net Migration Rate",
        unit: "per 1,000 population",
        axisUnit: "‰",
        yPadding: 5,
        subtitle: (entityName: string) => {
            if (entityName === "World") return "Not applicable"
            const region = getRegionByName(entityName)
            if (region?.regionType === "aggregate")
                return "Difference between people entering and leaving the continent, per 1,000 population"
            return "Difference between people entering and leaving the country, per 1,000 population"
        },
        tooltipContent:
            "Net migration is the difference in immigration (people entering the country) and emigration (people leaving). This number is positive if more people are entering than leaving. This difference is given per 1,000 population.",
        formatValue: (v) =>
            formatValue(v, {
                numDecimalPlaces: 1,
                numberAbbreviation: false,
                showPlus: true,
                trailingZeroes: true,
            }) + "‰",
        computeHistorical: (simulation) => {
            const points = R.pipe(
                HISTORICAL_TIME_RANGE,
                R.map((year) => ({
                    year,
                    value: getMigrationRateForYear(simulation.data, year),
                }))
            )
            const values = points.map((d) => d.value)
            return {
                points,
                min: Math.min(...values),
                max: Math.max(...values),
            }
        },
        computeUnwppProjection: (simulation) => {
            const points = R.pipe(
                PROJECTION_TIME_RANGE,
                R.map((year) => ({
                    year,
                    value: getProjectionMigrationRateForYear(
                        simulation.data,
                        year
                    ),
                }))
            )
            return { points }
        },
    },
}
