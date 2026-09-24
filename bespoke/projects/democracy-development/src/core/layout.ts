import { scaleLinear, scaleLog, scaleSqrt } from "d3-scale"

import { DEMOCRACY_RANGE, POPULATION_RADIUS_RANGE } from "./constants.js"
import type { Corner } from "./emptyCornerTriangle.js"
import type {
    AxisRange,
    DemocracyAxis,
    IndicatorSpec,
    ScatterPoint,
} from "./types.js"

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

/** What a panel needs to place a mark: a dot or one year of a trajectory */
export type PlottedValues = Pick<ScatterPoint, "democracy" | "indicator">

export interface PanelAxes {
    x: AxisDef
    y: AxisDef
    xScale: PixelScale
    yScale: PixelScale
    getX: (point: PlottedValues) => number
    getY: (point: PlottedValues) => number
    /** The corner of the plot area where countries are rarely found */
    emptyCorner: Corner
}

const DEMOCRACY_AXIS_DEF: AxisDef = {
    ...DEMOCRACY_RANGE,
    scale: "linear",
    formatTick: (v) => `${v}`,
}

function indicatorAxisDef(spec: IndicatorSpec, range: AxisRange): AxisDef {
    return {
        ...range,
        scale: spec.scale,
        formatTick: spec.formatTick,
    }
}

const LINEAR_TICK_COUNT = 5
/** Mantissas a log axis may start or end on: 1, 2, 5 times a power of ten */
const LOG_NICE_MANTISSAS = [1, 2, 5, 10]

/** A nice() step may pad the data by at most this share of its range */
const MAX_NICE_PADDING = 0.25

/**
 * A readable axis range covering `values`.
 *
 * A linear axis rounds its ends outwards to a tick; with `startAtZero` the
 * lower end is pinned to zero. If rounding to about five ticks would pad the
 * data by more than a quarter of its range, a finer step is used instead, so
 * a panel doesn't sit half empty. A log axis snaps both ends outwards to
 * 1, 2 or 5 times a power of ten and ticks at the powers of ten inside,
 * adding the 2 and 5 marks when that would leave fewer than two.
 */
export function computeAxisRange(
    values: number[],
    scale: "linear" | "log",
    { startAtZero = true }: { startAtZero?: boolean } = {}
): AxisRange {
    const positive = values.filter((v) => Number.isFinite(v) && v > 0)
    if (scale === "linear") {
        const max = positive.length ? Math.max(...positive) : 1
        const min = startAtZero || !positive.length ? 0 : Math.min(...positive)
        const span = Math.max(max - min, 1e-9)
        for (const tickCount of [LINEAR_TICK_COUNT, 2 * LINEAR_TICK_COUNT]) {
            const linear = scaleLinear().domain([min, max]).nice(tickCount)
            const [lo, hi] = linear.domain() as [number, number]
            const padding = Math.max(min - lo, hi - max) / span
            if (padding <= MAX_NICE_PADDING || tickCount > LINEAR_TICK_COUNT)
                return {
                    domain: [lo, hi],
                    ticks: linear.ticks(LINEAR_TICK_COUNT),
                }
        }
    }
    if (positive.length === 0) return { domain: [1, 10], ticks: [1, 10] }
    const lo = niceLogBound(Math.min(...positive), "floor")
    const hi = niceLogBound(Math.max(...positive), "ceil")
    let ticks = powersOfTen(lo, hi)
    if (ticks.length < 2)
        ticks = powersOfTen(lo, hi, [1, 2, 5]).filter((t) => t >= lo && t <= hi)
    return { domain: [lo, hi], ticks }
}

function niceLogBound(value: number, direction: "floor" | "ceil"): number {
    const exponent = Math.floor(Math.log10(value))
    const magnitude = Math.pow(10, exponent)
    const mantissa = value / magnitude
    const candidates = LOG_NICE_MANTISSAS
    const snapped =
        direction === "floor"
            ? [...candidates].reverse().find((m) => m <= mantissa + 1e-9)
            : candidates.find((m) => m >= mantissa - 1e-9)
    return (snapped ?? 1) * magnitude
}

function powersOfTen(
    lo: number,
    hi: number,
    mantissas: number[] = [1]
): number[] {
    const ticks: number[] = []
    for (
        let exponent = Math.floor(Math.log10(lo));
        exponent <= Math.ceil(Math.log10(hi));
        exponent++
    ) {
        for (const m of mantissas) {
            const tick = m * Math.pow(10, exponent)
            if (tick >= lo - 1e-9 && tick <= hi + 1e-9) ticks.push(tick)
        }
    }
    return ticks
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
    range,
    democracyAxis,
    plotWidth,
    plotHeight,
}: {
    spec: IndicatorSpec
    range: AxisRange
    democracyAxis: DemocracyAxis
    plotWidth: number
    plotHeight: number
}): PanelAxes {
    const indicatorAxis = indicatorAxisDef(spec, range)
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
