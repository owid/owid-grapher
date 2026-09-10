import type { Breakpoint } from "./useBreakpoint"

export interface PopulationChartFonts {
    xTick: number // x-axis year labels
    yTick: number // y-axis population labels
    pointLabel: number // endpoint value labels
    changeAnnotation: number // change % annotation
    projectionAnnotation: number // "Projections →" label
}

const POPULATION_CHART_FONTS: Record<
    Breakpoint | "extraNarrow",
    PopulationChartFonts
> = {
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
        changeAnnotation: 11,
        projectionAnnotation: 11,
    },
    small: {
        xTick: 12,
        yTick: 12,
        pointLabel: 12,
        changeAnnotation: 11,
        projectionAnnotation: 11,
    },
    narrow: {
        xTick: 11,
        yTick: 11,
        pointLabel: 11,
        changeAnnotation: 10,
        projectionAnnotation: 10,
    },
    extraNarrow: {
        xTick: 10,
        yTick: 10,
        pointLabel: 10,
        changeAnnotation: 9,
        projectionAnnotation: 9,
    },
}

export function getPopulationChartFonts(
    breakpoint: Breakpoint,
    windowBreakpoint: Breakpoint
): PopulationChartFonts {
    if (breakpoint === "narrow" && windowBreakpoint === "narrow")
        return POPULATION_CHART_FONTS.extraNarrow
    return POPULATION_CHART_FONTS[breakpoint]
}

export interface ParameterChartFonts {
    xTick: number // year labels below axis
    yTick: number // y-axis grid line labels
    pointLabel: number // point value labels (first/last)
    controlLabel: number // draggable control point value label
    hoverLabel: number // hover value label
    projectionAnnotation: number // "Projections →" label
    dragArrow: number // ▲/▼ arrows on control points
}

const PARAMETER_CHART_FONTS: Record<
    Breakpoint | "extraNarrow",
    ParameterChartFonts
> = {
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
        projectionAnnotation: 11,
        dragArrow: 8,
    },
    small: {
        xTick: 11,
        yTick: 12,
        pointLabel: 12,
        controlLabel: 12,
        hoverLabel: 12,
        projectionAnnotation: 11,
        dragArrow: 8,
    },
    narrow: {
        xTick: 11,
        yTick: 11,
        pointLabel: 11,
        controlLabel: 11,
        hoverLabel: 11,
        projectionAnnotation: 10,
        dragArrow: 8,
    },
    extraNarrow: {
        xTick: 10,
        yTick: 10,
        pointLabel: 10,
        controlLabel: 10,
        hoverLabel: 10,
        projectionAnnotation: 9,
        dragArrow: 8,
    },
}

export function getParameterChartFonts(
    breakpoint: Breakpoint,
    windowBreakpoint: Breakpoint
): ParameterChartFonts {
    if (breakpoint === "narrow" && windowBreakpoint === "narrow")
        return PARAMETER_CHART_FONTS.extraNarrow
    return PARAMETER_CHART_FONTS[breakpoint]
}

export interface PopulationPyramidFonts {
    xTick: number // x-axis population tick labels
    ageGroupLabel: number // age group labels (0-4, 5-9, etc.)
    sexLabel: number // "Women" / "Men" headers
    ageZoneLabel: number // age zone boundary/name labels
    hoverLabel: number // hovered bar value label
}

const POPULATION_PYRAMID_FONTS: Record<
    Breakpoint | "extraNarrow",
    PopulationPyramidFonts
> = {
    large: {
        xTick: 11,
        ageGroupLabel: 11,
        sexLabel: 11,
        ageZoneLabel: 11,
        hoverLabel: 11,
    },
    medium: {
        xTick: 11,
        ageGroupLabel: 11,
        sexLabel: 11,
        ageZoneLabel: 11,
        hoverLabel: 11,
    },
    small: {
        xTick: 11,
        ageGroupLabel: 11,
        sexLabel: 11,
        ageZoneLabel: 11,
        hoverLabel: 11,
    },
    narrow: {
        xTick: 10,
        ageGroupLabel: 10,
        sexLabel: 10,
        ageZoneLabel: 10,
        hoverLabel: 10,
    },
    extraNarrow: {
        xTick: 9,
        ageGroupLabel: 9,
        sexLabel: 9,
        ageZoneLabel: 9,
        hoverLabel: 9,
    },
}

export function getPopulationPyramidFonts(
    breakpoint: Breakpoint,
    windowBreakpoint: Breakpoint
): PopulationPyramidFonts {
    if (breakpoint === "narrow" && windowBreakpoint === "narrow")
        return POPULATION_PYRAMID_FONTS.extraNarrow
    return POPULATION_PYRAMID_FONTS[breakpoint]
}

export interface HorizontalPyramidFonts {
    yTick: number // grid line value labels + "people"
    xTick: number // age group tick labels
    sexLabel: number // "Women"/"Men" bar labels
    hoverLabel: number // hover bar value labels
}

const HORIZONTAL_PYRAMID_FONTS: Record<
    Breakpoint | "extraNarrow",
    HorizontalPyramidFonts
> = {
    large: {
        yTick: 12,
        xTick: 12,
        sexLabel: 9,
        hoverLabel: 10,
    },
    medium: {
        yTick: 12,
        xTick: 12,
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
    extraNarrow: {
        yTick: 9,
        xTick: 9,
        sexLabel: 7,
        hoverLabel: 8,
    },
}

export function getHorizontalPyramidFonts(
    breakpoint: Breakpoint,
    windowBreakpoint: Breakpoint
): HorizontalPyramidFonts {
    if (breakpoint === "narrow" && windowBreakpoint === "narrow")
        return HORIZONTAL_PYRAMID_FONTS.extraNarrow
    return HORIZONTAL_PYRAMID_FONTS[breakpoint]
}

export interface AgeZoneLegendFonts {
    totalPopulationLabel: number // "Total population: X"
    percentageLabel: number // bar segment percentages
    ageZoneLabel: number // zone name labels below bar
    valueLabel: number // zone population values below bar
}

const AGE_ZONE_LEGEND_FONTS: Record<
    Breakpoint | "extraNarrow",
    AgeZoneLegendFonts
> = {
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
        ageZoneLabel: 12,
        valueLabel: 12,
    },
    narrow: {
        totalPopulationLabel: 12,
        percentageLabel: 11,
        ageZoneLabel: 11,
        valueLabel: 11,
    },
    extraNarrow: {
        totalPopulationLabel: 11,
        percentageLabel: 10,
        ageZoneLabel: 10,
        valueLabel: 10,
    },
}

export function getAgeZoneLegendFonts(
    breakpoint: Breakpoint,
    windowBreakpoint: Breakpoint
): AgeZoneLegendFonts {
    if (breakpoint === "narrow" && windowBreakpoint === "narrow")
        return AGE_ZONE_LEGEND_FONTS.extraNarrow
    return AGE_ZONE_LEGEND_FONTS[breakpoint]
}
