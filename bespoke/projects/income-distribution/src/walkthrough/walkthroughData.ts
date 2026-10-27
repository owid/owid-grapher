import * as R from "remeda"

import { TIME_INTERVAL_FACTORS } from "../core/constants.js"
import {
    aggregateByRegion,
    computeCountrySeries,
    estimateLogDensity,
} from "../core/density.js"
import {
    REGIONS,
    type CountryDistribution,
    type IncomeDistributionYear,
    type Region,
} from "../core/types.js"
import {
    poolDistributions,
    type PooledDistribution,
} from "./pooledDistribution.js"

/** Days in a month, for the walkthrough's per-month figures */
export const DAYS_PER_MONTH = TIME_INTERVAL_FACTORS.monthly

/** The visible part of the income axis, in log2 int-$/day: $10 to $30,000 a month */
export const AXIS_MIN = Math.log2(10 / DAYS_PER_MONTH)
export const AXIS_MAX = Math.log2(30000 / DAYS_PER_MONTH)

/** The regional stack, bottom first, in the same order as the interactive chart's */
export const REGION_STACK: Region[] = [...REGIONS].reverse()

/** The populations the walkthrough quotes numbers for */
export type StatsKey = "world" | "subSaharanAfrica" | "northAmerica"

export interface WalkthroughData {
    year: number
    countries: CountryDistribution[]
    /** Each country's density (area 1), by name */
    countryCurves: Map<string, number[]>
    /**
     * Each region's density scaled by its share of the world's population,
     * so that the regions stacked add up to the world's density (area 1)
     */
    regionCurves: Map<Region, number[]>
    stats: Record<StatsKey, PooledDistribution>
}

export function buildWalkthroughData(
    yearData: IncomeDistributionYear
): WalkthroughData {
    const { countries } = yearData
    const worldPopulation = R.sumBy(countries, (c) => c.population)

    const countryCurves = new Map(
        countries.map((c) => [c.name, estimateLogDensity(c.avgs)])
    )
    const regionCurves = new Map(
        aggregateByRegion(computeCountrySeries(yearData)).map((s) => [
            s.region,
            s.density.map((d) => (d * s.population) / worldPopulation),
        ])
    )

    const inRegion = (region: Region): CountryDistribution[] =>
        countries.filter((c) => c.region === region)

    return {
        year: yearData.year,
        countries,
        countryCurves,
        regionCurves,
        stats: {
            world: poolDistributions(countries),
            subSaharanAfrica: poolDistributions(inRegion("Sub-Saharan Africa")),
            northAmerica: poolDistributions(inRegion("North America")),
        },
    }
}

/** "$90", "$1,200" (two significant figures from $1,000) */
export function formatPerMonth(perDay: number): string {
    const perMonth = perDay * DAYS_PER_MONTH
    if (perMonth >= 1000)
        return `$${Number(perMonth.toPrecision(2)).toLocaleString("en-US")}`
    return `$${Math.round(perMonth)}`
}

/** "$0.50", "$3", "$30" */
export function formatPerDay(perDay: number): string {
    if (perDay < 1) return `$${perDay.toFixed(2)}`
    return `$${Math.round(perDay)}`
}

/** "1.2 billion", "570 million" */
export function formatPeople(people: number): string {
    if (people >= 1e9) return `${Number((people / 1e9).toPrecision(2))} billion`
    return `${Math.round(people / 1e7) * 10} million`
}
