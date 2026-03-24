import { GRAY_50 } from "@ourworldindata/grapher/src/color/ColorConstants.js"
import { range } from "lodash-es"

export const DEFAULT_ENTITY_NAME = "South Korea"

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
export const FULL_TIME_RANGE = range(START_YEAR, END_YEAR + 1)

export const TREND_EARLY_START = 2000
export const TREND_EARLY_END = 2003
export const TREND_LATE_START = 2020
export const TREND_LATE_END = 2023

// Maximum age tracked (131 single-year ages: 0 to 130)
export const MAX_AGE = 130

export const PYRAMID_AGE_GROUP_SIZE = 5

export const PYRAMID_AGE_GROUPS: string[] = (() => {
    const groups: string[] = []
    for (
        let start = 0;
        start <= MAX_AGE - PYRAMID_AGE_GROUP_SIZE;
        start += PYRAMID_AGE_GROUP_SIZE
    ) {
        groups.push(`${start}-${start + PYRAMID_AGE_GROUP_SIZE - 1}`)
    }
    groups.push(`${MAX_AGE}+`)
    return groups
})()

export const DENIM_BLUE = "#4c6a9c"
export const GRID_LINE_COLOR = "#ddd"
export const ZERO_LINE_COLOR = GRAY_50
export const LABEL_COLOR = "#a1a1a1"

export const PROJECTION_BACKGROUND = "rgba(0, 0, 0, 0.02)"
export const PROJECTION_DASHARRAY = "1.5,3"

export const BENCHMARK_LINE_COLOR = "#bbb"
export const HOVER_LINE_COLOR = "rgba(180, 180, 180, 0.4)"

export const AGE_ZONE_BACKGROUND_OPACITY = 0.1

// Age zone colors
export const COLOR_WORKING = DENIM_BLUE
export const COLOR_DEPENDENT = "#93b2d5" // or: #8c4569
export const COLOR_CHILDREN = COLOR_DEPENDENT
export const COLOR_RETIRED = COLOR_DEPENDENT

export const MALE_COLOR = DENIM_BLUE
export const FEMALE_COLOR = COLOR_DEPENDENT

export const WORKING_AGE = 15
export const RETIREMENT_AGE = 65

// OWID data uses these 5-year age groups
export const OWID_AGE_GROUPS = [
    "0-4",
    "5-9",
    "10-14",
    "15-19",
    "20-24",
    "25-29",
    "30-34",
    "35-39",
    "40-44",
    "45-49",
    "50-54",
    "55-59",
    "60-64",
    "65-69",
    "70-74",
    "75-79",
    "80-84",
    "85-89",
    "90-94",
    "95-99",
    "100+",
]

// Fertility age groups in OWID data (mothers aged 10-54)
export const FERTILITY_AGE_GROUPS = [
    "10-14",
    "15-19",
    "20-24",
    "25-29",
    "30-34",
    "35-39",
    "40-44",
    "45-49",
    "50-54",
]

export const CHART_FOOTER_SOURCES =
    "Historical estimates from the UN World Population Prospects; user projection based on their inputs and a simple demographic projection model."
