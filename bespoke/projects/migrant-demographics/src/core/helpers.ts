import { formatValue } from "@ourworldindata/utils"
import { OwidVariableRoundingMode } from "@ourworldindata/types"

import { MigrantDemographics } from "./data.js"
import { PyramidData, SexValues, ShowMode } from "./types.js"

/** One age band's values, as the pyramid draws them */
export interface PyramidRow {
    band: string
    men: number
    women: number
}

export interface PyramidView {
    /** Migrant counts, or shares (%) of all migrants — oldest band first */
    migrants: PyramidRow[]
    /**
     * Native-born shares (%) of all native-born; only set while the
     * comparison is switched on
     */
    natives?: PyramidRow[]
}

/**
 * The values the pyramid displays for one entity and year, in the order it
 * draws them (oldest band at the top). In "share" mode each bar is the age
 * band's share of that entire population (both sexes combined), so all migrant
 * bars sum to 100% — and the native-born outline is comparable even though the
 * native population is far larger.
 */
export function computePyramidView(
    data: PyramidData,
    ageBands: string[],
    mode: ShowMode,
    compareWithNatives: boolean
): PyramidView {
    if (mode === "number") return { migrants: toRows(data.migrants, ageBands) }

    const migrants = toRows(data.migrants, ageBands, data.migrantsTotal.total)
    if (!compareWithNatives) return { migrants }
    return {
        migrants,
        natives: toRows(data.natives, ageBands, data.nativesTotal.total),
    }
}

/**
 * The largest displayed value across all years, so the axis stays fixed
 * while the user drags the time slider.
 */
export function computeAxisMax(
    data: MigrantDemographics,
    entityName: string,
    mode: ShowMode,
    compareWithNatives: boolean
): number {
    let max = 0
    for (const year of data.years) {
        const pyramidData = data.getPyramidData(entityName, year)
        if (!pyramidData) continue
        const view = computePyramidView(
            pyramidData,
            data.ageBands,
            mode,
            compareWithNatives
        )
        for (const rows of [view.migrants, view.natives]) {
            if (!rows) continue
            for (const row of rows) max = Math.max(max, row.men, row.women)
        }
    }
    return max
}

/** Tooltip count: "2,703,412" — unabbreviated, as Grapher tooltips do */
export function formatTooltipCount(value: number): string {
    return formatValue(value, {
        numDecimalPlaces: 0,
        numberAbbreviation: false,
    })
}

/** Tooltip share: "3.2%" — trailing zeroes kept so a column of them lines up */
export function formatTooltipShare(value: number): string {
    return formatValue(value, {
        unit: "%",
        numDecimalPlaces: 1,
        trailingZeroes: true,
    })
}

/** Tooltip title: "Ages 25–29" / "Ages 75 and older" */
export function formatAgeBand(band: string): string {
    if (band.endsWith("+")) return `Ages ${band.slice(0, -1)} and older`
    return `Ages ${band.replace("-", "–")}`
}

/** Axis tick label: "500k" / "1.5M" / "2%" */
export function formatAxisTick(value: number, mode: ShowMode): string {
    if (mode === "share")
        return formatValue(value, { unit: "%", numDecimalPlaces: 1 })
    return formatValue(value, {
        numDecimalPlaces: 0,
        numberAbbreviation: "short",
        abbreviationThreshold: 1e3,
    })
}

/**
 * Written-out count for the subtitle: "50.6 million". Three significant
 * figures rather than two — at two, most countries round to a suspiciously
 * neat figure ("51 million" for 50,632,836).
 */
export function formatCountLong(value: number): string {
    return formatValue(value, {
        roundingMode: OwidVariableRoundingMode.significantFigures,
        numSignificantFigures: 3,
        numberAbbreviation: "long",
    })
}

/** "(48%)" sex header annotation, or nothing when there's no total to divide by */
export function formatSexShare(
    part: number,
    total: number
): string | undefined {
    if (total <= 0) return undefined
    return `(${Math.round((part / total) * 100)}%)`
}

/**
 * Pairs the values with their age band and reverses them into display order.
 * With a `total`, values become percentages of it.
 */
function toRows(
    values: SexValues,
    ageBands: string[],
    total?: number
): PyramidRow[] {
    const scale = (v: number): number => {
        if (total === undefined) return v
        return total > 0 ? (v / total) * 100 : 0
    }
    return ageBands
        .map((band, i) => ({
            band,
            men: scale(values.men[i] ?? 0),
            women: scale(values.women[i] ?? 0),
        }))
        .reverse()
}
