/**
 * PROTOTYPE: build a fertility scenario anchored to national statistics
 * office (NSO) data instead of the UN WPP estimates.
 *
 * The forward assumption keeps the UN WPP medium trajectory's *shape* but
 * scales it by the ratio between the latest NSO observation and the UN's
 * value for that same year — i.e. it assumes the gap the national data shows
 * today persists, relative to the UN's assumed path. Observed NSO years after
 * the model's historical end year (2023) are used as additional control
 * points, so the projection follows the actual national data where it exists
 * before blending into the scaled UN path.
 */

import type { NsoTfrCountry } from "../helpers/nsoTfr"
import type { ScenarioParams } from "./scenarios"
import { getInterpolatedValue } from "./projectionRunner"

export interface NsoScenario {
    scenarioParams: ScenarioParams
    /** Includes the historical anchor year and observed post-anchor NSO years */
    controlYears: number[]
    /** The ratio applied to the UN WPP fertility control points */
    fertilityRatio: number
    /** Plot-ready fertility control points (anchor year onwards) */
    fertilityControlPoints: { year: number; value: number }[]
}

export function computeNsoScenario({
    nsoTfr,
    unwppScenario,
    historicalAnchors,
    historicalEndYear,
    controlYears,
}: {
    nsoTfr: NsoTfrCountry
    unwppScenario: ScenarioParams
    historicalAnchors: {
        fertilityRate: number
        lifeExpectancy: number
        netMigrationRate: number
    }
    historicalEndYear: number
    controlYears: readonly number[]
}): NsoScenario | null {
    const series = nsoTfr.nso
    if (!series || series.length === 0) return null

    // Anchor: the NSO observation at the historical end year, or the last one
    // before it
    const atOrBefore = series.filter(([year]) => year <= historicalEndYear)
    const anchor = atOrBefore.at(-1) ?? series[0]
    const anchorValue = anchor[1]

    // Observed NSO years after the anchor year become extra control points
    const postAnchor = series.filter(
        ([year]) => year > historicalEndYear && year < controlYears[0]
    )
    const latest = series.at(-1)!
    const [latestYear, latestValue] = latest

    // UN WPP medium value at the latest observed year, for the scaling ratio.
    // Prefer the extracted WPP medium projection series (covers ~2023-2032);
    // fall back to interpolating the UN scenario control points.
    const wppAtLatest =
        latestYear <= historicalEndYear
            ? historicalAnchors.fertilityRate
            : (nsoTfr.wppProjection?.medium?.find(
                  ([year]) => Math.round(year) === latestYear
              )?.[1] ??
              getInterpolatedValue(
                  {
                      [historicalEndYear]: historicalAnchors.fertilityRate,
                      ...unwppScenario.fertilityRate,
                  },
                  latestYear,
                  historicalEndYear,
                  [historicalEndYear, ...controlYears]
              ))

    if (!wppAtLatest || !isFinite(wppAtLatest) || !isFinite(latestValue))
        return null
    const fertilityRatio = Math.min(
        2.5,
        Math.max(0.25, latestValue / wppAtLatest)
    )

    const scaledFertility: Record<number, number> = {}
    for (const year of controlYears) {
        scaledFertility[year] = unwppScenario.fertilityRate[year]
            ? unwppScenario.fertilityRate[year] * fertilityRatio
            : anchorValue
    }

    const augmentedControlYears = [
        historicalEndYear,
        ...postAnchor.map(([year]) => year),
        ...controlYears,
    ]

    // Life expectancy and migration follow the UN WPP scenario; the extra
    // control years need explicit values, interpolated from the UN path.
    const interpolateUn = (
        points: Record<number, number>,
        anchorVal: number,
        year: number
    ): number =>
        getInterpolatedValue(
            { [historicalEndYear]: anchorVal, ...points },
            year,
            historicalEndYear,
            [historicalEndYear, ...controlYears]
        )

    const lifeExpectancy: Record<number, number> = {
        [historicalEndYear]: historicalAnchors.lifeExpectancy,
        ...unwppScenario.lifeExpectancy,
    }
    const netMigrationRate: Record<number, number> = {
        [historicalEndYear]: historicalAnchors.netMigrationRate,
        ...unwppScenario.netMigrationRate,
    }
    const fertilityRate: Record<number, number> = {
        [historicalEndYear]: anchorValue,
        ...scaledFertility,
    }
    for (const [year, value] of postAnchor) {
        fertilityRate[year] = value
        lifeExpectancy[year] = interpolateUn(
            unwppScenario.lifeExpectancy,
            historicalAnchors.lifeExpectancy,
            year
        )
        netMigrationRate[year] = interpolateUn(
            unwppScenario.netMigrationRate,
            historicalAnchors.netMigrationRate,
            year
        )
    }

    const fertilityControlPoints = augmentedControlYears.map((year) => ({
        year,
        value: fertilityRate[year],
    }))

    return {
        scenarioParams: { fertilityRate, lifeExpectancy, netMigrationRate },
        controlYears: augmentedControlYears,
        fertilityRatio,
        fertilityControlPoints,
    }
}
