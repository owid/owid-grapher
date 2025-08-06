import * as R from "remeda"
import * as _ from "lodash-es"
import {
    sortNumeric,
    isArrayOfNumbers,
    findGreatestCommonDivisorOfArray,
    rollingMap,
    omitUndefinedValues,
    checkHasMembers,
    getCountryNamesForRegion,
    Region,
    EntityName,
    excludeUndefined,
    getRegionByName,
} from "@ourworldindata/utils"
import { StackedPointPositionType, StackedSeries } from "./StackedConstants"
import { WORLD_ENTITY_NAME } from "../core/GrapherConstants.js"

// This method shift up the Y Values of a Series with Points in place.
export const stackSeries = <PositionType extends StackedPointPositionType>(
    seriesArr: readonly StackedSeries<PositionType>[]
): readonly StackedSeries<PositionType>[] => {
    seriesArr.forEach((series, seriesIndex) => {
        if (!seriesIndex) return // The first series does not need to be shifted
        series.points.forEach((point, pointIndex) => {
            const pointBelowThisOne =
                seriesArr[seriesIndex - 1].points[pointIndex]
            point.valueOffset =
                pointBelowThisOne.value + pointBelowThisOne.valueOffset
        })
    })
    return seriesArr
}

// This method shifts up positive y values and shifts down negative y values of a Series with Points in place.
export const stackSeriesInBothDirections = <
    PositionType extends StackedPointPositionType,
>(
    seriesArr: readonly StackedSeries<PositionType>[]
): readonly StackedSeries<PositionType>[] => {
    seriesArr.forEach((series, seriesIndex) => {
        if (!seriesIndex) return // The first series does not need to be shifted
        series.points.forEach((point, pointIndex) => {
            const pointsBelowThisOne = seriesArr
                .slice(0, seriesIndex)
                .map((s) => s.points[pointIndex])
            const pointBelowThisOne =
                point.value < 0
                    ? pointsBelowThisOne.findLast((p) => p.value < 0)
                    : pointsBelowThisOne.findLast((p) => p.value >= 0)
            point.valueOffset = pointBelowThisOne
                ? pointBelowThisOne.value + pointBelowThisOne.valueOffset
                : 0
        })
    })
    return seriesArr
}

// Makes sure that values are evenly spaced
export function withUniformSpacing(values: number[]): number[] {
    const deltas = rollingMap(values, (a, b) => b - a)
    const gcd = findGreatestCommonDivisorOfArray(deltas)
    if (gcd === null) return values
    return _.range(values[0], values[values.length - 1] + gcd, gcd)
}

// Adds a Y = 0 value for each missing x value (where X is usually Time)
export const withMissingValuesAsZeroes = <
    PositionType extends StackedPointPositionType,
>(
    seriesArr: readonly StackedSeries<PositionType>[],
    { enforceUniformSpacing = false }: { enforceUniformSpacing?: boolean } = {}
): StackedSeries<PositionType>[] => {
    let allXValuesSorted = sortNumeric(
        _.uniq(
            seriesArr
                .flatMap((series) => series.points)
                .map((point) => point.position)
        )
    )

    if (enforceUniformSpacing && isArrayOfNumbers(allXValuesSorted)) {
        allXValuesSorted = withUniformSpacing(
            allXValuesSorted
        ) as PositionType[]
    }

    return seriesArr.map((series) => {
        const pointsByPosition = _.keyBy(series.points, "position")
        return {
            ...series,
            points: allXValuesSorted.map((position) => {
                const point = pointsByPosition[position]
                const value = point?.value ?? 0
                const time = point?.time ?? 0
                return omitUndefinedValues({
                    time,
                    position,
                    value,
                    valueOffset: 0,
                    interpolated: point?.interpolated,
                    fake: !point || !!point.interpolated,
                    color: point?.color,
                })
            }),
        }
    })
}

/**
 * Checks if the given entities can be sensibly stacked on top of each other.
 *
 * For example, stacking countries on top of their continent or stacking
 * countries on top of the world doesn't make sense.
 */
export function checkIsStackingEntitiesSensible(
    entityNames: EntityName[]
): boolean {
    if (entityNames.length < 2) return true

    // Stacking entities on top of World typically doesn't make sense
    if (entityNames.includes(WORLD_ENTITY_NAME)) return false

    // Grab region info where available
    const regions = excludeUndefined(
        entityNames.map((name) => getRegionByName(name))
    )
    if (regions.length < 2) return true

    // If none of the regions have members, we don't need to check further
    const someRegionHasMembers = regions.some((region) =>
        checkHasMembers(region)
    )
    if (!someRegionHasMembers) return true

    // Keep track of the stacked countries and check if the same country is
    // stacked twice, e.g. by stacking Spain on top of Europe (Europe contains
    // Spain) or by stacking Europe on top of World (both contain Spain)
    const stackedCountryNames = new Set(getCountryNames(regions[0]))
    for (const region of regions.slice(1)) {
        const newCountryNames = getCountryNames(region)

        // check if any new country is already part of the current stack
        const someCountryIsAlreadyStacked = newCountryNames.some(
            (countryName) => stackedCountryNames.has(countryName)
        )
        if (someCountryIsAlreadyStacked) return false

        // add all new countries to the stack
        newCountryNames.forEach((countryName) =>
            stackedCountryNames.add(countryName)
        )
    }
    return true
}

function getCountryNames(region: Region): string[] {
    return checkHasMembers(region)
        ? getCountryNamesForRegion(region)
        : [region.name]
}

export function resolveCollision(
    s1: StackedSeries<number>,
    s2: StackedSeries<number>
): StackedSeries<number> | undefined {
    // Early return if one series is all zeroes
    if (s1.isAllZeros && !s2.isAllZeros) return s2
    if (s2.isAllZeros && !s1.isAllZeros) return s1

    // Prefer series with a higher maximum value
    const yMax1 = _.maxBy(s1.points, (p) => p.value)?.value ?? 0
    const yMax2 = _.maxBy(s2.points, (p) => p.value)?.value ?? 0
    if (yMax1 > yMax2) return s1
    if (yMax2 > yMax1) return s2

    // Prefer series with a higher last value
    const yLast1 = R.last(s1.points)?.value ?? 0
    const yLast2 = R.last(s2.points)?.value ?? 0
    if (yLast1 > yLast2) return s1
    if (yLast2 > yLast1) return s2

    // Prefer series with a higher total area
    const area1 = _.sumBy(s1.points, (p) => p.value)
    const area2 = _.sumBy(s2.points, (p) => p.value)
    if (area1 > area2) return s1
    if (area2 > area1) return s2

    return undefined // no preference
}
