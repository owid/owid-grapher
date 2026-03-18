/**
 * Shared constants for population simulator.
 */

import { range } from "lodash-es"

export const START_YEAR = 1950
export const HISTORICAL_END_YEAR = 2023
export const END_YEAR = 2100
export const BASELINE_START_YEAR = 2004 // Last 20 years for baseline
export const CONTROL_YEARS = [2030, 2050, 2100] as const

export const HISTORICAL_TIME_RANGE = range(START_YEAR, HISTORICAL_END_YEAR + 1)
export const PROJECTION_TIME_RANGE = range(
    HISTORICAL_END_YEAR + 1,
    END_YEAR + 1
)

export const TREND_EARLY_START = 2000
export const TREND_EARLY_END = 2003
export const TREND_LATE_START = 2020
export const TREND_LATE_END = 2023

export const CHART_MAJOR_TICK_YEARS = [1950, 2000, 2050, 2100]

export const PYRAMID_AGE_GROUPS: string[] = (() => {
    const groups: string[] = []
    for (let start = 0; start <= 125; start += 5) {
        groups.push(`${start}-${start + 4}`)
    }
    groups.push("130+")
    return groups
})()

export const DENIM_BLUE = "#4c6a9c"
export const GRID_LINE_COLOR = "#ddd"
export const LABEL_COLOR = "#a1a1a1"

export const PROJECTION_BACKGROUND = "rgba(0, 0, 0, 0.02)"
export const PROJECTION_DASHARRAY = "1.5,3"

export const BENCHMARK_LINE_COLOR = "#bbb"
