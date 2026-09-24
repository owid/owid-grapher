import { format } from "d3-format"

import { GRAPHER_DENIM } from "@ourworldindata/grapher/src/color/ColorConstants.js"

import type { AxisRange, IndicatorSpec } from "./types.js"

export const DATA_API_URL = "https://api.ourworldindata.org/v1/indicators/"

/** V-Dem's Liberal Democracy Index, central estimate */
export const DEMOCRACY_VARIABLE_ID = 1209797
/** Population (historical), used for sizing */
export const POPULATION_VARIABLE_ID = 953903

export const DEMOCRACY_RANGE: AxisRange = { domain: [0, 1], ticks: [0, 0.5, 1] }

/** The slider starts here: the first year all four indicators cover */
export const START_YEAR = 1990

/**
 * A year on the slider shows, per indicator, the most recent value within
 * this many years before it (inclusive of the year itself). The democracy
 * score is always taken from the slider year exactly.
 */
export const MATCH_TOLERANCE_YEARS = 5

export const DEFAULT_DOT_COLOR = GRAPHER_DENIM
export const DEFAULT_DOT_RADIUS = 3.5
export const POPULATION_RADIUS_RANGE: [number, number] = [2, 16]

const formatDollarTick = format("$~s")
const formatDollarValue = format("$,.0f")
const formatPercent1 = format(".1f")
const formatYears1 = format(".1f")

export const INDICATOR_SPECS: IndicatorSpec[] = [
    {
        key: "gdp",
        variableId: 1294305,
        title: "GDP per capita",
        subtitle:
            "Average economic output per person per year, in international-$ at 2021 prices; adjusted for inflation and price differences between countries. Shown on a log scale.",
        scale: "log",
        formatTick: formatDollarTick,
        formatValue: formatDollarValue,
        emptyCornerAtLowValue: true,
    },
    {
        key: "childMortality",
        variableId: 1271844,
        title: "Child mortality rate",
        subtitle: "Share of newborns who die before reaching the age of five.",
        scale: "linear",
        formatTick: (v) => `${v}%`,
        formatValue: (v) => `${formatPercent1(v)}%`,
        emptyCornerAtLowValue: false,
    },
    {
        key: "poverty",
        variableId: 1281383,
        title: "Share of people in poverty",
        subtitle:
            "Share of the population living on less than $10 a day, at 2021 prices; adjusted for price differences between countries. Based on household surveys, so many countries only have data every few years.",
        scale: "linear",
        formatTick: (v) => `${v}%`,
        formatValue: (v) => `${formatPercent1(v)}%`,
        emptyCornerAtLowValue: false,
    },
    {
        key: "schooling",
        variableId: 1032433,
        title: "Expected years of schooling",
        subtitle:
            "Number of years a child starting school can expect to spend in education if current enrollment rates persist.",
        scale: "linear",
        formatTick: (v) => `${v}`,
        formatValue: (v) => `${formatYears1(v)} years`,
        emptyCornerAtLowValue: true,
    },
]

export const DEFAULT_TITLE = "How democracy relates to development"
