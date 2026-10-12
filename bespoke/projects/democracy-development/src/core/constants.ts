import { ContinentColors } from "@ourworldindata/grapher/src/color/CustomSchemes.js"
import {
    GRAPHER_DENIM,
    GRAY_80,
} from "@ourworldindata/grapher/src/color/ColorConstants.js"

import type { IndexKey, OutcomeKey, SeriesKey } from "./types.js"
import type { Scale } from "./axis.js"

// ------------------------------------------------------------------------------------------------
// Colors: grapher's ContinentColors, so the dots match every other chart on the site
// ------------------------------------------------------------------------------------------------
export function continentColor(continent: string): string {
    return (ContinentColors as Record<string, string>)[continent] ?? GRAY_80
}

/** INACTIVE_SCATTER_POINT_COLOR */
export const INACTIVE_POINT_COLOR = "#e2e2e2"
export const POINT_STROKE = "#666"
export const POINT_STROKE_HOVER = "#333"
/** TICK_COLOR, SOLID_TICK_COLOR */
export const TICK_COLOR = "#ddd"
export const FAINT_TICK_COLOR = "#eee"
export const SOLID_TICK_COLOR = "#999"
export const TICK_LABEL_COLOR = GRAY_80

// ------------------------------------------------------------------------------------------------
// Sizes
// ------------------------------------------------------------------------------------------------
/** SCATTER_POINT_DEFAULT_RADIUS */
export const POINT_RADIUS = 3
/** SCATTER_POINT_MIN_RADIUS */
export const POINT_MIN_RADIUS = 2
/** The largest bubble when sized by population; grapher scales area with a sqrt scale from 0 */
export const POINT_MAX_RADIUS = 14
export const PANEL_MARGIN = { top: 8, right: 10, bottom: 26 }
/** Below this width the four panels stack in one column */
export const SINGLE_COLUMN_BREAKPOINT = 640

/** Countries with fewer people than this are hidden unless the reader asks for them */
export const SMALL_COUNTRY_POP = 500_000

/**
 * A chart that says "2025" should show the most recent estimate rather than an empty panel, so an
 * indicator that carries no tolerance of its own gets a short one here: three years for child
 * mortality (IGME publishes annually), five for population.
 */
export const TOLERANCE_MIN: Partial<Record<SeriesKey, number>> = {
    child_mortality: 3,
    population: 5,
}

// ------------------------------------------------------------------------------------------------
// The x axis: which democracy index, how it reads, how it formats
// ------------------------------------------------------------------------------------------------
export interface XVar {
    key: IndexKey
    /** The dropdown's label */
    label: string
    /** The dropdown's second line */
    optionDesc: string
    axisLabel: string
    domain: [number, number]
    ticks: number[]
    fmtTick: (v: number) => string
    fmt: (v: number) => string
    tooltipName: string
    /** The main subtitle; `name` is set in bold */
    subtitle: { pre: string; name: string; post: string }
    /** Legs of the empty-corner triangle, as fractions of the plot, one per panel */
    wedgeLeg: Record<OutcomeKey, number>
}

const fmtOneDecimal = (v: number): string => v.toFixed(1).replace(/\.0$/, "")

// One leg per index and panel, each chosen against every year the index covers (small countries
// excluded, as in the default view) so that the corner is empty or brushed only marginally. The
// indices differ because they place the same countries differently: the Electoral Democracy Index
// sits countries further right than the Liberal one, and Freedom House compresses democracies into
// 80-100, so their empty corners are smaller. Poverty is always the smallest: at $10 a day, several
// democracies (India, Ghana, Benin) have most people below the line.
export const X_VARS: Record<IndexKey, XVar> = {
    libdem: {
        key: "libdem",
        label: "V-Dem's Liberal Democracy Index",
        optionDesc:
            "V-Dem · 0 to 1 · elections, constraints on power, civil rights",
        axisLabel: "Liberal Democracy Index (V-Dem) →",
        domain: [0, 1],
        ticks: [0, 0.2, 0.4, 0.6, 0.8, 1],
        fmtTick: fmtOneDecimal,
        fmt: (v) => v.toFixed(2),
        tooltipName: "Liberal Democracy Index",
        subtitle: {
            pre: "Each dot is a country, placed by its score on ",
            name: "V-Dem's Liberal Democracy Index",
            post: ", from 0 (least democratic) to 1 (most democratic). The index covers free and fair elections, constraints on power, and civil rights.",
        },
        wedgeLeg: {
            gdp: 0.55,
            child_mortality: 0.55,
            poverty10: 0.4,
            eys: 0.55,
        },
    },
    electdem: {
        key: "electdem",
        label: "V-Dem's Electoral Democracy Index",
        optionDesc:
            "V-Dem · 0 to 1 · free and fair elections under wide suffrage",
        axisLabel: "Electoral Democracy Index (V-Dem) →",
        domain: [0, 1],
        ticks: [0, 0.2, 0.4, 0.6, 0.8, 1],
        fmtTick: fmtOneDecimal,
        fmt: (v) => v.toFixed(2),
        tooltipName: "Electoral Democracy Index",
        subtitle: {
            pre: "Each dot is a country, placed by its score on ",
            name: "V-Dem's Electoral Democracy Index",
            post: ", from 0 (least democratic) to 1 (most democratic). The index covers the extent to which leaders are chosen in free and fair elections under wide suffrage, with freedom of association and expression.",
        },
        wedgeLeg: {
            gdp: 0.44,
            child_mortality: 0.44,
            poverty10: 0.28,
            eys: 0.44,
        },
    },
    eiu: {
        key: "eiu",
        label: "Democracy Index (EIU)",
        optionDesc:
            "Economist Intelligence Unit · 0 to 10 · elections, government, participation, culture, liberties; since 2006",
        axisLabel: "Democracy Index (Economist Intelligence Unit) →",
        domain: [0, 10],
        ticks: [0, 2, 4, 6, 8, 10],
        fmtTick: (v) => String(v),
        fmt: (v) => v.toFixed(2),
        tooltipName: "Democracy Index (EIU)",
        subtitle: {
            pre: "Each dot is a country, placed by its score on the ",
            name: "Economist Intelligence Unit's Democracy Index",
            post: ", from 0 (least democratic) to 10 (most democratic). The index covers the electoral process, the functioning of government, political participation, political culture, and civil liberties.",
        },
        wedgeLeg: { gdp: 0.5, child_mortality: 0.5, poverty10: 0.25, eys: 0.5 },
    },
    fh: {
        key: "fh",
        label: "Freedom House total score",
        optionDesc:
            "Freedom House · 0 to 100 · political rights and civil liberties, since 2002",
        axisLabel: "Freedom House total democracy score →",
        domain: [0, 100],
        ticks: [0, 25, 50, 75, 100],
        fmtTick: (v) => String(v),
        fmt: (v) => String(v),
        tooltipName: "Freedom House total score",
        subtitle: {
            pre: "Each dot is a country, placed by its ",
            name: "Freedom House total democracy score",
            post: ", from 0 (least free) to 100 (most free). The score, from the Freedom in the World report, adds up points on 25 indicators of political rights (up to 40) and civil liberties (up to 60).",
        },
        wedgeLeg: {
            gdp: 0.38,
            child_mortality: 0.38,
            poverty10: 0.2,
            eys: 0.38,
        },
    },
}

// ------------------------------------------------------------------------------------------------
// The y axes: the four development measures. Higher is better in every panel, so the two shares
// that count bad outcomes (child mortality, poverty) are shown as their complements; `transform` is
// applied wherever the indicator's value is drawn or read (dots, axis, tooltip), the source
// indicator is unchanged. No panel has an author minimum: every axis is the year's own extent, so
// the bottom edge of each plot is the worst-performing country that year -- which is what gives the
// shaded corners a single meaning.
// ------------------------------------------------------------------------------------------------
export interface YVar {
    key: OutcomeKey
    title: string
    unit: string
    scale: Scale
    authorMin?: number
    authorMax?: number
    transform?: (v: number) => number
    fmtTick: (v: number) => string
    fmt: (v: number) => string
    tooltipName: string
    tooltipUnit: string
    /** The sentence the empty corner makes, and the predicate alone for a corner too small for it */
    wedgeLabel: string
    wedgeLabelShort: string
}

function fmtNum(v: number): string {
    return Math.abs(v) >= 1000
        ? Math.round(v).toLocaleString("en-US")
        : String(+v.toFixed(6))
}
const fmtDollars = (v: number): string =>
    "$" + Math.round(v).toLocaleString("en-US")

export const Y_VARS: Record<OutcomeKey, YVar> = {
    gdp: {
        key: "gdp",
        title: "Incomes: GDP per capita",
        unit: "Average income per person, in int-$ at 2021 prices, adjusted for differences in living costs. Log scale.",
        scale: "log",
        fmtTick: fmtDollars,
        fmt: fmtDollars,
        tooltipName: "GDP per capita",
        tooltipUnit: "international-$ in 2021 prices",
        wedgeLabel: "There are no poor highly democratic countries",
        wedgeLabelShort: "Not poor",
    },
    child_mortality: {
        key: "child_mortality",
        title: "Health: Children surviving to age 5",
        unit: "Share of newborns who live to their fifth birthday: 100% minus the child mortality rate.",
        scale: "linear",
        transform: (v) => 100 - v,
        fmtTick: (v) => fmtNum(v) + "%",
        fmt: (v) => v.toFixed(1) + "%",
        tooltipName: "Children surviving to age 5",
        tooltipUnit: "share of newborns",
        wedgeLabel:
            "Highly democratic countries don't have high child mortality",
        wedgeLabelShort: "Low child mortality",
    },
    poverty10: {
        key: "poverty10",
        title: "Poverty: People above the poverty line",
        unit: "Share living on more than $10 a day, at 2021 prices adjusted for differences in living costs: 100% minus the poverty rate.",
        scale: "linear",
        transform: (v) => 100 - v,
        fmtTick: (v) => fmtNum(v) + "%",
        fmt: (v) => v.toFixed(1) + "%",
        tooltipName: "People living on more than $10 a day",
        tooltipUnit: "share of population",
        wedgeLabel: "Highly democratic countries don't have widespread poverty",
        wedgeLabelShort: "No widespread poverty",
    },
    eys: {
        key: "eys",
        title: "Education: Expected years of schooling",
        unit: "Years of schooling a child starting school today can expect to receive, if current enrollment rates persist.",
        scale: "linear",
        fmtTick: fmtNum,
        fmt: (v) => v.toFixed(1) + " years",
        tooltipName: "Expected years of schooling",
        tooltipUnit: "years",
        wedgeLabel: "High democracy goes together with more education",
        wedgeLabelShort: "More education",
    },
}

/** Denim, as a transparent tint */
export const WEDGE_FILL = GRAPHER_DENIM
export const WEDGE_FILL_OPACITY = 0.1
export const WEDGE_STROKE_OPACITY = 0.28

export const CHART_TITLE = "How democracy relates to development"

export const TOLERANCE_NOTE =
    "Democracy scores are for the year shown. Where a development measure has no value for that year, the closest year within a few years is shown."
export const SMALL_COUNTRIES_NOTE = `Countries with fewer than ${SMALL_COUNTRY_POP.toLocaleString("en-US")} people are not shown.`
