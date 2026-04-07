import type { Breakpoint } from "./useBreakpoint"

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
        xTick: 12,
        yTick: 12,
        pointLabel: 12,
        changeAnnotation: 11,
        projectionAnnotation: 11,
    },
    medium: {
        xTick: 12,
        yTick: 12,
        pointLabel: 12,
        changeAnnotation: 12,
        projectionAnnotation: 12,
    },
    small: {
        xTick: 11,
        yTick: 11,
        pointLabel: 11,
        changeAnnotation: 11,
        projectionAnnotation: 11,
    },
    narrow: {
        xTick: 11,
        yTick: 11,
        pointLabel: 11,
        changeAnnotation: 11,
        projectionAnnotation: 11,
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
    yTick: number // y-axis grid line labels
    pointLabel: number // point value labels (first/last)
    controlLabel: number // draggable control point value label
    hoverLabel: number // hover value label
    projectionAnnotation: number // "Projections →" label
    dragArrow: number // ▲/▼ arrows on control points
}

const PARAMETER_CHART_FONTS: Record<Breakpoint, ParameterChartFonts> = {
    large: {
        xTick: 12,
        yTick: 12,
        pointLabel: 12,
        controlLabel: 12,
        hoverLabel: 12,
        projectionAnnotation: 11,
        dragArrow: 8,
    },
    medium: {
        xTick: 12,
        yTick: 12,
        pointLabel: 12,
        controlLabel: 12,
        hoverLabel: 12,
        projectionAnnotation: 12,
        dragArrow: 8,
    },
    small: {
        xTick: 11,
        yTick: 11,
        pointLabel: 11,
        controlLabel: 11,
        hoverLabel: 11,
        projectionAnnotation: 11,
        dragArrow: 8,
    },
    narrow: {
        xTick: 11,
        yTick: 11,
        pointLabel: 11,
        controlLabel: 11,
        hoverLabel: 11,
        projectionAnnotation: 11,
        dragArrow: 8,
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
    hoverLabel: number // hovered bar value label
}

const POPULATION_PYRAMID_FONTS: Record<Breakpoint, PopulationPyramidFonts> = {
    large: {
        xTick: 13,
        ageGroupLabel: 10.5,
        sexLabel: 11,
        ageZoneLabel: 11,
        hoverLabel: 10.5,
    },
    medium: {
        xTick: 12,
        ageGroupLabel: 10.5,
        sexLabel: 11,
        ageZoneLabel: 11,
        hoverLabel: 10.5,
    },
    small: {
        xTick: 11,
        ageGroupLabel: 11,
        sexLabel: 12,
        ageZoneLabel: 12,
        hoverLabel: 11,
    },
    narrow: {
        xTick: 10,
        ageGroupLabel: 9,
        sexLabel: 10,
        ageZoneLabel: 10,
        hoverLabel: 9,
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
        yTick: 12,
        xTick: 12,
        sexLabel: 9,
        hoverLabel: 10,
    },
    medium: {
        yTick: 11,
        xTick: 11,
        sexLabel: 9,
        hoverLabel: 10,
    },
    small: {
        yTick: 10,
        xTick: 10,
        sexLabel: 8,
        hoverLabel: 9,
    },
    narrow: {
        yTick: 10,
        xTick: 10,
        sexLabel: 8,
        hoverLabel: 9,
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
        totalPopulationLabel: 13,
        percentageLabel: 12,
        ageZoneLabel: 12,
        valueLabel: 12,
    },
    medium: {
        totalPopulationLabel: 13,
        percentageLabel: 12,
        ageZoneLabel: 12,
        valueLabel: 12,
    },
    small: {
        totalPopulationLabel: 13,
        percentageLabel: 12,
        ageZoneLabel: 13,
        valueLabel: 13,
    },
    narrow: {
        totalPopulationLabel: 12,
        percentageLabel: 11,
        ageZoneLabel: 11,
        valueLabel: 11,
    },
}

export function getAgeZoneLegendFonts(
    breakpoint: Breakpoint
): AgeZoneLegendFonts {
    return AGE_ZONE_LEGEND_FONTS[breakpoint]
}
