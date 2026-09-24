import { scaleLinear, scaleLog, scaleSqrt } from "d3-scale"

import {
    DEMOCRACY_DOMAIN,
    DEMOCRACY_TICKS,
    POPULATION_RADIUS_RANGE,
} from "./constants.js"
import type { Corner } from "./emptyCornerTriangle.js"
import type { DemocracyAxis, IndicatorSpec, ScatterPoint } from "./types.js"

export interface AxisDef {
    domain: [number, number]
    scale: "linear" | "log"
    ticks: number[]
    formatTick: (value: number) => string
}

/** A continuous scale from data value to pixel */
export type PixelScale = ((value: number) => number) & {
    domain: () => number[]
}

export interface PanelAxes {
    x: AxisDef
    y: AxisDef
    xScale: PixelScale
    yScale: PixelScale
    getX: (point: ScatterPoint) => number
    getY: (point: ScatterPoint) => number
    /** The corner of the plot area where countries are rarely found */
    emptyCorner: Corner
}

const DEMOCRACY_AXIS_DEF: AxisDef = {
    domain: DEMOCRACY_DOMAIN,
    scale: "linear",
    ticks: DEMOCRACY_TICKS,
    formatTick: (v) => `${v}`,
}

function indicatorAxisDef(spec: IndicatorSpec): AxisDef {
    return {
        domain: spec.domain,
        scale: spec.scale,
        ticks: spec.ticks,
        formatTick: spec.formatTick,
    }
}

function makeScale(axis: AxisDef, range: [number, number]): PixelScale {
    return (axis.scale === "log" ? scaleLog() : scaleLinear())
        .domain(axis.domain)
        .range(range)
        .clamp(true)
}

/**
 * Wire up both axes of a panel for the chosen orientation. Pixel y runs
 * downward, so the y scale's range is flipped.
 */
export function getPanelAxes({
    spec,
    democracyAxis,
    plotWidth,
    plotHeight,
}: {
    spec: IndicatorSpec
    democracyAxis: DemocracyAxis
    plotWidth: number
    plotHeight: number
}): PanelAxes {
    const indicatorAxis = indicatorAxisDef(spec)
    const democracyOnY = democracyAxis === "y"
    const x = democracyOnY ? indicatorAxis : DEMOCRACY_AXIS_DEF
    const y = democracyOnY ? DEMOCRACY_AXIS_DEF : indicatorAxis

    // Where highly democratic countries are rare for this indicator:
    // horizontally, the high-democracy end or the indicator's empty end;
    // vertically the same, remembering that pixel 0 is the top.
    const emptyCorner: Corner = democracyOnY
        ? { u: spec.emptyCornerAtLowValue ? 0 : 1, v: 0 }
        : { u: 1, v: spec.emptyCornerAtLowValue ? 1 : 0 }

    return {
        x,
        y,
        xScale: makeScale(x, [0, plotWidth]),
        yScale: makeScale(y, [plotHeight, 0]),
        getX: (point) =>
            democracyOnY ? point.indicator.value : point.democracy.value,
        getY: (point) =>
            democracyOnY ? point.democracy.value : point.indicator.value,
        emptyCorner,
    }
}

/** Dot radius from population; a square-root scale keeps area proportional */
export function makeRadiusScale(
    maxPopulation: number
): (population: number | undefined) => number {
    const scale = scaleSqrt()
        .domain([0, Math.max(maxPopulation, 1)])
        .range(POPULATION_RADIUS_RANGE)
    return (population) => scale(population ?? 0)
}

export interface GridLayout {
    columns: 1 | 2
    panelWidth: number
    plotHeight: number
    gap: number
}

const GRID_GAP = 24
const SINGLE_COLUMN_BELOW = 560

export function getGridLayout(containerWidth: number): GridLayout {
    const columns = containerWidth < SINGLE_COLUMN_BELOW ? 1 : 2
    const panelWidth = (containerWidth - GRID_GAP * (columns - 1)) / columns
    const plotHeight = Math.round(
        Math.min(300, Math.max(190, panelWidth * 0.7))
    )
    return { columns, panelWidth, plotHeight, gap: GRID_GAP }
}
