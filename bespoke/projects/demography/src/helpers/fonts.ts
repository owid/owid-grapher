import type { Breakpoint } from "./useBreakpoint"

// ── Shared defaults ──────────────────────────────────────────────────
// Used as baseline values; individual charts can override.

const TICK_L = 11
const TICK_M = 10
const TICK_S = 9

const LABEL_L = 9
const LABEL_M = 9
const LABEL_S = 8

const ANNOTATION_L = 10
const ANNOTATION_M = 10
const ANNOTATION_S = 9

const SYMBOL_L = 7
const SYMBOL_M = 7
const SYMBOL_S = 6

// ── PopulationChart ──────────────────────────────────────────────────

export interface PopulationChartFonts {
    xTick: number // x-axis year labels
    yTick: number // y-axis population labels
    pointLabel: number // endpoint value labels
    changeAnnotation: number // change % annotation
    projectionAnnotation: number // "Projections →" label
}

const POPULATION_CHART_FONTS: Record<Breakpoint, PopulationChartFonts> = {
    large: {
        xTick: TICK_L,
        yTick: TICK_L,
        pointLabel: TICK_L,
        changeAnnotation: ANNOTATION_L,
        projectionAnnotation: ANNOTATION_L,
    },
    medium: {
        xTick: TICK_M,
        yTick: TICK_M,
        pointLabel: TICK_M,
        changeAnnotation: ANNOTATION_M,
        projectionAnnotation: ANNOTATION_M,
    },
    small: {
        xTick: TICK_S,
        yTick: TICK_S,
        pointLabel: TICK_S,
        changeAnnotation: ANNOTATION_S,
        projectionAnnotation: ANNOTATION_S,
    },
    narrow: {
        xTick: TICK_S,
        yTick: TICK_S,
        pointLabel: TICK_S,
        changeAnnotation: ANNOTATION_S,
        projectionAnnotation: ANNOTATION_S,
    },
}

export function getPopulationChartFonts(
    breakpoint: Breakpoint
): PopulationChartFonts {
    return POPULATION_CHART_FONTS[breakpoint]
}

// ── ParameterChart (DemographyParameterEditor) ───────────────────────

export interface ParameterChartFonts {
    xTick: number // year labels below axis
    pointLabel: number // point value labels (first/last)
    controlLabel: number // draggable control point value label
    hoverLabel: number // hover value label
    projectionAnnotation: number // "Projections →" label
    dragArrow: number // ▲/▼ arrows on control points
}

const PARAMETER_CHART_FONTS: Record<Breakpoint, ParameterChartFonts> = {
    large: {
        xTick: LABEL_L,
        pointLabel: LABEL_L,
        controlLabel: LABEL_L,
        hoverLabel: LABEL_L,
        projectionAnnotation: ANNOTATION_L,
        dragArrow: SYMBOL_L,
    },
    medium: {
        xTick: LABEL_M,
        pointLabel: LABEL_M,
        controlLabel: LABEL_M,
        hoverLabel: LABEL_M,
        projectionAnnotation: ANNOTATION_M,
        dragArrow: SYMBOL_M,
    },
    small: {
        xTick: LABEL_S + 2,
        pointLabel: LABEL_S + 2,
        controlLabel: LABEL_S + 1,
        hoverLabel: LABEL_S + 2,
        projectionAnnotation: ANNOTATION_S + 1,
        dragArrow: SYMBOL_S + 1,
    },
    narrow: {
        xTick: LABEL_S + 1,
        pointLabel: LABEL_S + 1,
        controlLabel: LABEL_S + 1,
        hoverLabel: LABEL_S + 1,
        projectionAnnotation: ANNOTATION_S + 1,
        dragArrow: SYMBOL_S + 1,
    },
}

export function getParameterChartFonts(
    breakpoint: Breakpoint
): ParameterChartFonts {
    return PARAMETER_CHART_FONTS[breakpoint]
}

// ── PopulationPyramid ────────────────────────────────────────────────

export interface PopulationPyramidFonts {
    xTick: number // x-axis population tick labels
    ageGroupLabel: number // age group labels (0-4, 5-9, etc.)
    sexLabel: number // "Women" / "Men" headers
    ageZoneLabel: number // age zone boundary/name labels
}

const POPULATION_PYRAMID_FONTS: Record<Breakpoint, PopulationPyramidFonts> = {
    large: {
        xTick: TICK_L + 1,
        ageGroupLabel: (LABEL_L + ANNOTATION_L) / 2,
        sexLabel: ANNOTATION_L,
        ageZoneLabel: ANNOTATION_L,
    },
    medium: {
        xTick: TICK_M + 1,
        ageGroupLabel: (LABEL_M + ANNOTATION_M) / 2,
        sexLabel: ANNOTATION_M,
        ageZoneLabel: ANNOTATION_M,
    },
    small: {
        xTick: TICK_S,
        ageGroupLabel: ANNOTATION_S,
        sexLabel: ANNOTATION_M,
        ageZoneLabel: ANNOTATION_M,
    },
    narrow: {
        xTick: TICK_S - 1,
        ageGroupLabel: ANNOTATION_S - 2,
        sexLabel: ANNOTATION_S - 1,
        ageZoneLabel: ANNOTATION_S - 1,
    },
}

export function getPopulationPyramidFonts(
    breakpoint: Breakpoint
): PopulationPyramidFonts {
    return POPULATION_PYRAMID_FONTS[breakpoint]
}

// ── PopulationPyramidHorizontal ──────────────────────────────────────

export interface HorizontalPyramidFonts {
    yTick: number // grid line value labels + "people"
    xTick: number // age group tick labels
    sexLabel: number // "Women"/"Men" bar labels
    hoverLabel: number // hover bar value labels
}

const HORIZONTAL_PYRAMID_FONTS: Record<Breakpoint, HorizontalPyramidFonts> = {
    large: {
        yTick: TICK_L,
        xTick: TICK_L,
        sexLabel: LABEL_L - 1,
        hoverLabel: LABEL_L,
    },
    medium: {
        yTick: TICK_M,
        xTick: TICK_M,
        sexLabel: LABEL_M - 1,
        hoverLabel: LABEL_M,
    },
    small: {
        yTick: TICK_S,
        xTick: TICK_S,
        sexLabel: LABEL_S - 1,
        hoverLabel: LABEL_S,
    },
    narrow: {
        yTick: TICK_S,
        xTick: TICK_S,
        sexLabel: LABEL_S - 1,
        hoverLabel: LABEL_S,
    },
}

export function getHorizontalPyramidFonts(
    breakpoint: Breakpoint
): HorizontalPyramidFonts {
    return HORIZONTAL_PYRAMID_FONTS[breakpoint]
}

// ── AgeZoneLegend ────────────────────────────────────────────────────

export interface AgeZoneLegendFonts {
    totalPopulationLabel: number // "Total population: X"
    percentageLabel: number // bar segment percentages
    ageZoneLabel: number // zone name labels below bar
    valueLabel: number // zone population values below bar
}

const AGE_ZONE_LEGEND_FONTS: Record<Breakpoint, AgeZoneLegendFonts> = {
    large: {
        totalPopulationLabel: 12,
        percentageLabel: 11,
        ageZoneLabel: 11,
        valueLabel: 11,
    },
    medium: {
        totalPopulationLabel: 12,
        percentageLabel: 11,
        ageZoneLabel: 11,
        valueLabel: 11,
    },
    small: {
        totalPopulationLabel: 12,
        percentageLabel: 11,
        ageZoneLabel: 11,
        valueLabel: 11,
    },
    narrow: {
        totalPopulationLabel: 11,
        percentageLabel: 10,
        ageZoneLabel: 10,
        valueLabel: 10,
    },
}

export function getAgeZoneLegendFonts(
    breakpoint: Breakpoint
): AgeZoneLegendFonts {
    return AGE_ZONE_LEGEND_FONTS[breakpoint]
}
