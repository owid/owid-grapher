import type { EntityName } from "@ourworldindata/types"
import { getContinentForCountry } from "@ourworldindata/utils"

import type {
    IndicatorData,
    IndicatorSeries,
    MatchedValue,
    ScatterPoint,
} from "./types.js"

/**
 * The value for `year` exactly, if the series has one.
 * Series are sorted by year, so a binary search would do; the series are
 * short (a few hundred years at most) and this runs once per dot per render.
 */
export function getValueInYear(
    series: IndicatorSeries,
    year: number
): MatchedValue | undefined {
    const index = series.years.indexOf(year)
    if (index === -1) return undefined
    return { value: series.values[index], year }
}

/**
 * The most recent value in the window `[year - tolerance, year]`.
 * Returns the value together with the year it comes from, so the tooltip can
 * say when a dot's data is older than the slider year.
 */
export function getLatestValueUpTo(
    series: IndicatorSeries,
    year: number,
    tolerance: number
): MatchedValue | undefined {
    for (let i = series.years.length - 1; i >= 0; i--) {
        const seriesYear = series.years[i]
        if (seriesYear > year) continue
        if (seriesYear < year - tolerance) return undefined
        return { value: series.values[i], year: seriesYear }
    }
    return undefined
}

/**
 * Pair every country's democracy score in `year` with its indicator value
 * from the same year or, failing that, the most recent one within
 * `tolerance` years before. Countries missing either side are left out.
 */
export function buildScatterPoints({
    democracy,
    indicator,
    population,
    year,
    tolerance,
}: {
    democracy: IndicatorData
    indicator: IndicatorData
    population?: IndicatorData
    year: number
    tolerance: number
}): ScatterPoint[] {
    const points: ScatterPoint[] = []
    for (const [entityName, democracySeries] of democracy.byEntity) {
        const democracyValue = getValueInYear(democracySeries, year)
        if (!democracyValue) continue

        const indicatorSeries = indicator.byEntity.get(entityName)
        if (!indicatorSeries) continue
        const indicatorValue = getLatestValueUpTo(
            indicatorSeries,
            year,
            tolerance
        )
        if (!indicatorValue) continue

        const continent = getContinentForCountry(entityName)
        if (!continent) continue

        points.push({
            entityName,
            continent,
            democracy: democracyValue,
            indicator: indicatorValue,
            population: getPopulation(population, entityName, year),
        })
    }
    return points
}

/**
 * Population for sizing. The population series ends a year or two before
 * the newest democracy scores, so it falls back to the latest value up to a
 * decade old — sizes are only a visual aid.
 */
function getPopulation(
    population: IndicatorData | undefined,
    entityName: EntityName,
    year: number
): number | undefined {
    const series = population?.byEntity.get(entityName)
    if (!series) return undefined
    return getLatestValueUpTo(series, year, 10)?.value
}

/** Every year from `start` to the last year the democracy index covers */
export function getSliderYears(
    democracy: IndicatorData,
    start: number
): number[] {
    const end = democracy.metadata.maxYear
    const years: number[] = []
    for (let year = start; year <= end; year++) years.push(year)
    return years
}

/**
 * Every country value of an indicator from `startYear` on: what a fixed axis
 * has to cover so that no dot leaves the panel in any year of the slider.
 */
export function getValuesFromYear(
    indicator: IndicatorData,
    startYear: number
): number[] {
    const values: number[] = []
    for (const series of indicator.byEntity.values()) {
        for (let i = 0; i < series.years.length; i++) {
            if (series.years[i] >= startYear) values.push(series.values[i])
        }
    }
    return values
}
