import type { EntityName } from "@ourworldindata/types"

export type VariantName = "scatter"

export const INDICATOR_KEYS = [
    "gdp",
    "childMortality",
    "poverty",
    "schooling",
] as const
export type IndicatorKey = (typeof INDICATOR_KEYS)[number]

/** Which axis carries the Liberal Democracy Index */
export const DEMOCRACY_AXES = ["x", "y"] as const
export type DemocracyAxis = (typeof DEMOCRACY_AXES)[number]

export interface IndicatorSpec {
    key: IndicatorKey
    variableId: number
    /** Panel title */
    title: string
    /** Panel subtitle: definition, unit, and anything that used to be a footnote */
    subtitle: string
    scale: "linear" | "log"
    /** Whether a linear axis has to start at zero; off for indicators whose values never come near it */
    startAtZero: boolean
    formatTick: (value: number) => string
    formatValue: (value: number) => string
    /**
     * Whether the corner without countries sits at the *low* end of this
     * indicator (true for GDP: highly democratic countries are rarely poor)
     * or at the high end (child mortality: they rarely have high mortality).
     */
    emptyCornerAtLowValue: boolean
    /** Written inside the shaded empty corner */
    annotation: string
}

/** One indicator's values, grouped by entity and sorted by year */
export interface IndicatorSeries {
    years: number[]
    values: number[]
}

export interface IndicatorMetadata {
    name: string
    /** "Producer (year)" attributions, deduplicated */
    attributions: string[]
    /** The earliest and latest year with any value */
    minYear: number
    maxYear: number
}

export interface IndicatorData {
    byEntity: Map<EntityName, IndicatorSeries>
    metadata: IndicatorMetadata
}

/** A matched value: the value itself and the year it was actually taken from */
export interface MatchedValue {
    value: number
    year: number
}

/** One dot in one panel */
export interface ScatterPoint {
    entityName: EntityName
    continent: string
    democracy: MatchedValue
    indicator: MatchedValue
    population?: number
}

/** One year on a country's path through a panel */
export interface TrajectoryPoint {
    year: number
    democracy: MatchedValue
    indicator: MatchedValue
}

export interface HoverState {
    entityName: EntityName
    /** The panel the pointer is in; the tooltip renders there */
    panelKey: IndicatorKey
    position: { x: number; y: number }
}

/** An axis range with the tick values to draw along it */
export interface AxisRange {
    domain: [number, number]
    ticks: number[]
}
