import { maxBy } from "lodash"
import { utcFormat } from "d3"

import { TickFormattingOptions } from "charts/TickFormattingOptions"
import { dateDiffInDays, formatValue } from "charts/Util"

import {
    CovidSeries,
    CovidDatum,
    CovidDoublingRange,
    CovidSortKey,
    CovidCountryDatum,
    SortOrder,
    CovidSortAccessor
} from "./CovidTypes"

export function inverseSortOrder(order: SortOrder): SortOrder {
    return order === SortOrder.asc ? SortOrder.desc : SortOrder.asc
}

export function parseIntOrUndefined(s: string | undefined) {
    if (s === undefined) return undefined
    const value = parseInt(s)
    return isNaN(value) ? undefined : value
}

export function formatInt(
    n: number | undefined,
    defaultValue: string = "",
    options: TickFormattingOptions = {}
): string {
    return n === undefined || isNaN(n) ? defaultValue : formatValue(n, options)
}

export const defaultTimeFormat = utcFormat("%B %e")

export function formatDate(
    date: Date | undefined,
    defaultValue: string = ""
): string {
    if (date === undefined) return defaultValue
    return defaultTimeFormat(date)
}

export function createNoun(singular: string, plural: string) {
    return (num: number | undefined) => {
        if (num === 1) return singular
        return plural
    }
}

export function getDoublingRange(
    series: CovidSeries,
    accessor: (d: CovidDatum) => number | undefined
): CovidDoublingRange | undefined {
    if (series.length > 1) {
        const latestDay = maxBy(series, d => d.date) as CovidDatum
        const latestValue = accessor(latestDay)
        if (latestValue === undefined) return undefined
        const filteredSeries = series.filter(d => {
            const value = accessor(d)
            return value && value <= latestValue / 2
        })
        const halfDay = maxBy(filteredSeries, d => d.date)
        if (halfDay === undefined) return undefined
        const halfValue = accessor(halfDay)
        if (halfValue === undefined) return undefined
        return {
            latestDay,
            halfDay,
            length: dateDiffInDays(latestDay.date, halfDay.date),
            ratio: latestValue / halfValue
        }
    }
    return undefined
}

export const sortAccessors: Record<CovidSortKey, CovidSortAccessor> = {
    location: (d: CovidCountryDatum) => d.location,
    totalCases: (d: CovidCountryDatum) => d.latest?.total_cases,
    newCases: (d: CovidCountryDatum) => d.latest?.new_cases,
    totalDeaths: (d: CovidCountryDatum) => d.latest?.total_deaths,
    newDeaths: (d: CovidCountryDatum) => d.latest?.new_deaths,
    daysToDoubleCases: (d: CovidCountryDatum) => d.caseDoublingRange?.length,
    daysToDoubleDeaths: (d: CovidCountryDatum) => d.deathDoublingRange?.length
}
