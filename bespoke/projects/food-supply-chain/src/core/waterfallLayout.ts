import { tickStep } from "d3-array"

import { STAGE_GROUPS, StageGroup } from "./stageGroups.js"
import { Waterfall, WaterfallStep } from "./waterfall.js"

/** Shortest bar the chart draws */
export const MIN_BAR_LENGTH_PX = 0.5

/** Share of a slot left empty on each side of its bar */
const SLOT_PADDING_RATIO = 0.2
/** How far a group's box reaches past its outer bars, in slots */
const GROUP_BOX_OVERHANG_RATIO = 0.08

const TICK_COUNT = 5

export interface Box {
    x: number
    y: number
    width: number
    height: number
}

export interface PlacedPoint {
    x: number
    y: number
}

export interface PlacedLine {
    x1: number
    y1: number
    x2: number
    y2: number
}

export interface PlacedRect {
    x: number
    y: number
    width: number
    height: number
}

export interface PlacedBar extends PlacedRect {
    /** True when MIN_BAR_LENGTH_PX won over the step's own length */
    isFloored: boolean
}

/** One column of the chart, whether or not it draws a bar */
export interface PlacedStep {
    /** The model step this column draws; the total's runs from zero to its value */
    step: WaterfallStep
    /** The whole slot across the value axis: the hit area and the caption's column */
    slot: PlacedRect
    /** Absent when the delta is exactly zero */
    bar?: PlacedBar
    /** The far end of the bar */
    valueAnchor: PlacedPoint
    /** The low end of the value axis */
    captionAnchor: PlacedPoint
}

export interface PlacedTick {
    value: number
    /** Runs the length of the step axis */
    gridline: PlacedLine
}

export interface PlacedGroup {
    group: StageGroup
    /** The group's columns, over the plot's whole value range */
    box: PlacedRect
}

export interface WaterfallLayout {
    steps: PlacedStep[]
    total: PlacedStep
    connectors: PlacedLine[]
    ticks: PlacedTick[]
    zeroLine: PlacedLine
    groups: PlacedGroup[]
}

/** The pixels a group's box runs over, given the pixels one column gets */
export function groupBoxLength(slotWidth: number, stageCount: number): number {
    return (
        slotWidth *
        (stageCount - 2 * SLOT_PADDING_RATIO + 2 * GROUP_BOX_OVERHANG_RATIO)
    )
}

export function layOutWaterfall(
    waterfall: Waterfall,
    box: Box
): WaterfallLayout {
    return projectPlan(planWaterfall(waterfall), box, VERTICAL_PROJECTION)
}

/** A closed interval on one axis; a point is an interval whose ends are equal */
interface Span {
    from: number
    to: number
}

/** A mark, as the value interval it covers crossed with the step interval it covers */
interface Extent {
    value: Span
    step: Span
}

interface PlannedStep {
    step: WaterfallStep
    slot: Extent
    bar?: Extent
    valueAnchor: Extent
    captionAnchor: Extent
}

interface PlannedTick {
    value: number
    gridline: Extent
}

interface PlannedGroup {
    group: StageGroup
    box: Extent
}

interface WaterfallPlan {
    /** The waterfall's domain widened to the outermost ticks */
    valueDomain: Span
    /** `[0, slotCount]`, one unit per column */
    stepDomain: Span
    steps: PlannedStep[]
    total: PlannedStep
    connectors: Extent[]
    ticks: PlannedTick[]
    zeroLine: Extent
    groups: PlannedGroup[]
}

function planWaterfall(waterfall: Waterfall): WaterfallPlan {
    const { ticks, domain: valueDomain } = chooseTicks(waterfall.domain)
    const stepDomain: Span = { from: 0, to: waterfall.steps.length + 1 }

    const steps = waterfall.steps.map((step, index) =>
        planStep(step, index, valueDomain)
    )
    const total = planStep(
        totalAsStep(waterfall.total),
        waterfall.steps.length,
        valueDomain
    )

    return {
        valueDomain,
        stepDomain,
        steps,
        total,
        connectors: planConnectors([...steps, total]),
        ticks: ticks.map((value) => ({
            value,
            gridline: { value: { from: value, to: value }, step: stepDomain },
        })),
        zeroLine: { value: { from: 0, to: 0 }, step: stepDomain },
        groups: planGroups(waterfall.steps, valueDomain),
    }
}

function planGroups(steps: WaterfallStep[], valueDomain: Span): PlannedGroup[] {
    const slotIndexByKey = new Map(
        steps.map((step, index) => [step.key, index])
    )

    return STAGE_GROUPS.flatMap((group) => {
        const slotIndices = group.stageKeys
            .map((key) => slotIndexByKey.get(key))
            .filter((index) => index !== undefined)
        if (slotIndices.length === 0) return []
        if (!areSlotsContiguous(slotIndices)) return []

        const first = Math.min(...slotIndices)
        const last = Math.max(...slotIndices)

        return [
            {
                group,
                box: {
                    value: valueDomain,
                    step: {
                        from:
                            paddedSlotSpan(first).from -
                            GROUP_BOX_OVERHANG_RATIO,
                        to: paddedSlotSpan(last).to + GROUP_BOX_OVERHANG_RATIO,
                    },
                },
            },
        ]
    })
}

function areSlotsContiguous(slotIndices: number[]): boolean {
    const first = Math.min(...slotIndices)
    const last = Math.max(...slotIndices)
    return last - first + 1 === slotIndices.length
}

/** The total column, as the step from zero that it draws */
function totalAsStep(total: Waterfall["total"]): WaterfallStep {
    const { key, name, value } = total
    return { key, name, delta: value, balanceBefore: 0, balanceAfter: value }
}

function planStep(
    step: WaterfallStep,
    slotIndex: number,
    valueDomain: Span
): PlannedStep {
    return {
        step,
        slot: { value: valueDomain, step: slotSpan(slotIndex) },
        bar:
            step.delta === 0
                ? undefined
                : {
                      value: {
                          from: step.balanceBefore,
                          to: step.balanceAfter,
                      },
                      step: paddedSlotSpan(slotIndex),
                  },
        valueAnchor: {
            value: { from: step.balanceAfter, to: step.balanceAfter },
            step: slotCentre(slotIndex),
        },
        captionAnchor: {
            value: { from: valueDomain.from, to: valueDomain.from },
            step: slotCentre(slotIndex),
        },
    }
}

/** One connector per adjacent pair of drawn bars, at the value they share */
function planConnectors(slots: PlannedStep[]): Extent[] {
    const stepsWithBars = slots.filter(
        (planned): planned is PlannedStep & { bar: Extent } =>
            planned.bar !== undefined
    )

    const connectors: Extent[] = []
    for (let i = 0; i < stepsWithBars.length - 1; i++) {
        const left = stepsWithBars[i]
        const right = stepsWithBars[i + 1]
        connectors.push({
            value: { from: left.step.balanceAfter, to: left.step.balanceAfter },
            step: { from: left.bar.step.to, to: right.bar.step.from },
        })
    }
    return connectors
}

/** Round tick values covering the domain, and the domain widened to reach them */
function chooseTicks(domain: [number, number]): {
    ticks: number[]
    domain: Span
} {
    let [lo, hi] = domain
    if (lo === hi) {
        lo -= 1
        hi += 1
    }

    const step = tickStep(lo, hi, TICK_COUNT)
    const from = Math.floor(lo / step) * step
    const to = Math.ceil(hi / step) * step

    const count = Math.round((to - from) / step)
    const ticks: number[] = []
    for (let i = 0; i <= count; i++) ticks.push(from + i * step)

    return { ticks, domain: { from, to } }
}

/** The interval slot `index` occupies */
function slotSpan(index: number): Span {
    return { from: index, to: index + 1 }
}

/** Slot `index` less its padding, which is where the bar goes */
function paddedSlotSpan(index: number): Span {
    return {
        from: index + SLOT_PADDING_RATIO,
        to: index + 1 - SLOT_PADDING_RATIO,
    }
}

/** The centre of slot `index`, as an interval whose ends coincide */
function slotCentre(index: number): Span {
    return { from: index + 0.5, to: index + 0.5 }
}

/** A mark after scaling, as the pixels it covers along each axis */
interface PxExtent {
    alongValue: Span
    alongStep: Span
}

interface LinearScale {
    domain: Span
    range: Span
}

/** The only code that knows which screen axis carries values */
interface ScreenProjection {
    /** The pixels each axis gets from the box, running in its screen direction */
    axes(box: Box): PxExtent
    /** Assigns the two px spans to screen axes, keeping each one's direction */
    toSegment(px: PxExtent): PlacedLine
}

/** Values run up the box, steps run left to right */
const VERTICAL_PROJECTION: ScreenProjection = {
    axes: (box) => ({
        alongValue: { from: box.y + box.height, to: box.y },
        alongStep: { from: box.x, to: box.x + box.width },
    }),
    toSegment: (px) => ({
        x1: px.alongStep.from,
        y1: px.alongValue.from,
        x2: px.alongStep.to,
        y2: px.alongValue.to,
    }),
}

function projectPlan(
    plan: WaterfallPlan,
    box: Box,
    projection: ScreenProjection
): WaterfallLayout {
    const axes = projection.axes(box)
    const scales = {
        value: { domain: plan.valueDomain, range: axes.alongValue },
        step: { domain: plan.stepDomain, range: axes.alongStep },
    }

    const placeStep = (planned: PlannedStep): PlacedStep => {
        let bar: PlacedBar | undefined
        if (planned.bar) {
            const px = scaleExtent(planned.bar, scales)
            const { span: alongValue, isFloored } = floorBarLength(
                px.alongValue,
                planned.step.delta,
                axes.alongValue
            )
            bar = {
                ...toRect(
                    projection.toSegment({
                        alongValue,
                        alongStep: px.alongStep,
                    })
                ),
                isFloored,
            }
        }

        return {
            step: planned.step,
            slot: toRect(
                projection.toSegment(scaleExtent(planned.slot, scales))
            ),
            bar,
            valueAnchor: toPoint(
                projection.toSegment(scaleExtent(planned.valueAnchor, scales))
            ),
            captionAnchor: toPoint(
                projection.toSegment(scaleExtent(planned.captionAnchor, scales))
            ),
        }
    }

    return {
        steps: plan.steps.map(placeStep),
        total: placeStep(plan.total),
        connectors: plan.connectors.map((extent) =>
            projection.toSegment(scaleExtent(extent, scales))
        ),
        ticks: plan.ticks.map((tick) => ({
            value: tick.value,
            gridline: projection.toSegment(scaleExtent(tick.gridline, scales)),
        })),
        zeroLine: projection.toSegment(scaleExtent(plan.zeroLine, scales)),
        groups: plan.groups.map((planned) => ({
            group: planned.group,
            box: toRect(projection.toSegment(scaleExtent(planned.box, scales))),
        })),
    }
}

function scaleExtent(
    extent: Extent,
    scales: { value: LinearScale; step: LinearScale }
): PxExtent {
    return {
        alongValue: scaleSpan(extent.value, scales.value),
        alongStep: scaleSpan(extent.step, scales.step),
    }
}

function scaleSpan(span: Span, scale: LinearScale): Span {
    const { domain, range } = scale
    const factor = (range.to - range.from) / (domain.to - domain.from)
    return {
        from: range.from + (span.from - domain.from) * factor,
        to: range.from + (span.to - domain.from) * factor,
    }
}

/**
 * Grows a bar shorter than MIN_BAR_LENGTH_PX to that length, keeping its near
 * end and sliding it back inside the axis when the floor pushes it out.
 */
function floorBarLength(
    bar: Span,
    delta: number,
    axis: Span
): { span: Span; isFloored: boolean } {
    const length = Math.abs(bar.to - bar.from)
    if (length >= MIN_BAR_LENGTH_PX) return { span: bar, isFloored: false }

    const direction = Math.sign(axis.to - axis.from) * Math.sign(delta)
    const to = bar.from + direction * MIN_BAR_LENGTH_PX

    const axisMin = Math.min(axis.from, axis.to)
    const axisMax = Math.max(axis.from, axis.to)
    const spanMin = Math.min(bar.from, to)
    const spanMax = Math.max(bar.from, to)

    let overhang = 0
    if (spanMax > axisMax) overhang = spanMax - axisMax
    else if (spanMin < axisMin) overhang = spanMin - axisMin

    return {
        span: { from: bar.from - overhang, to: to - overhang },
        isFloored: true,
    }
}

/** Normalises a directed segment into an SVG rect */
function toRect(segment: PlacedLine): PlacedRect {
    return {
        x: Math.min(segment.x1, segment.x2),
        y: Math.min(segment.y1, segment.y2),
        width: Math.abs(segment.x2 - segment.x1),
        height: Math.abs(segment.y2 - segment.y1),
    }
}

/** The start of a segment */
function toPoint(segment: PlacedLine): PlacedPoint {
    return { x: segment.x1, y: segment.y1 }
}
