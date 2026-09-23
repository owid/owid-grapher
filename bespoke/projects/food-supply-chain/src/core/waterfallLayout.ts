import { tickStep } from "d3-array"

import { STAGE_GROUPS, StageGroup } from "./stageGroups.js"
import { Waterfall, WaterfallStep } from "./waterfall.js"

/** Shortest bar the chart draws */
export const MIN_BAR_LENGTH_PX = 1

/** Share of a slot left empty on each side of its bar */
const SLOT_PADDING_RATIO = 0.15
/** How far a group's box reaches past its outer bars, in slots */
const GROUP_BOX_OVERHANG_RATIO = 0.08
/** The total's column width, in step columns */
const TOTAL_SLOT_SPAN = 1.5

const TICK_COUNT_BY_ORIENTATION: Record<WaterfallOrientation, number> = {
    vertical: 5,
    horizontal: 3,
}

export type WaterfallOrientation = "vertical" | "horizontal"

export interface WaterfallLayoutOptions {
    orientation?: WaterfallOrientation
    /** Room before each group's first slot, in slots */
    groupHeaderSlots?: number
    /** Extra room before each group's box and the total's, in slots */
    boxGapSlots?: number
}

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
}

export interface PlacedConnector {
    /** The step whose bar the connector leaves from */
    leftStep: WaterfallStep
    line: PlacedLine
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
    connectors: PlacedConnector[]
    /** From the last drawn step's bar to the total's, at the total's value */
    totalConnector?: PlacedLine
    ticks: PlacedTick[]
    zeroLine: PlacedLine
    groups: PlacedGroup[]
    /** The total's column, over the plot's whole value range */
    totalBox: PlacedRect
}

/** The pixels one step's column gets */
export function measureSlotWidth(plotWidth: number, stepCount: number): number {
    return plotWidth / (stepCount + TOTAL_SLOT_SPAN)
}

/** The pixels a group's box runs over, given the pixels one column gets */
export function groupBoxLength(slotWidth: number, stageCount: number): number {
    return (
        slotWidth *
        (stageCount - 2 * SLOT_PADDING_RATIO + 2 * GROUP_BOX_OVERHANG_RATIO)
    )
}

/** The pixels the total's box runs over, given the pixels one step's column gets */
export function totalBoxLength(slotWidth: number): number {
    return (
        slotWidth *
        (TOTAL_SLOT_SPAN -
            2 * SLOT_PADDING_RATIO +
            2 * GROUP_BOX_OVERHANG_RATIO)
    )
}

/** Slots on the step axis: one per step, the total's wider one, and the room around the boxes */
export function countStepAxisSlots(
    steps: WaterfallStep[],
    { groupHeaderSlots = 0, boxGapSlots = 0 }: WaterfallLayoutOptions
): number {
    return planStepAxis(steps, groupHeaderSlots, boxGapSlots).totalSlot.to
}

/** The group header room, in slots, that starts a group's box `headerHeightPx` above its first slot */
export function measureGroupHeaderSlots(
    headerHeightPx: number,
    slotLengthPx: number
): number {
    return (
        headerHeightPx / slotLengthPx +
        SLOT_PADDING_RATIO -
        GROUP_BOX_OVERHANG_RATIO
    )
}

/** The pixels a caption gets, from its bar's left edge to the end of its slot */
export function captionLength(slotWidth: number): number {
    return slotWidth * (1 - SLOT_PADDING_RATIO)
}

/** The values the value axis puts a tick and gridline at */
export function chooseTickValues(
    domain: [number, number],
    orientation: WaterfallOrientation = "vertical"
): number[] {
    return chooseTicks(domain, TICK_COUNT_BY_ORIENTATION[orientation]).ticks
}

export function layOutWaterfall(
    waterfall: Waterfall,
    box: Box,
    {
        orientation = "vertical",
        groupHeaderSlots = 0,
        boxGapSlots = 0,
    }: WaterfallLayoutOptions = {}
): WaterfallLayout {
    return projectPlan(
        planWaterfall(
            waterfall,
            TICK_COUNT_BY_ORIENTATION[orientation],
            groupHeaderSlots,
            boxGapSlots
        ),
        box,
        PROJECTIONS[orientation]
    )
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
}

interface PlannedConnector {
    leftStep: WaterfallStep
    line: Extent
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
    /** One unit per step's column, then the total's wider one */
    stepDomain: Span
    steps: PlannedStep[]
    total: PlannedStep
    connectors: PlannedConnector[]
    totalConnector?: Extent
    ticks: PlannedTick[]
    zeroLine: Extent
    groups: PlannedGroup[]
    totalBox: Extent
}

function planWaterfall(
    waterfall: Waterfall,
    tickCount: number,
    groupHeaderSlots: number,
    boxGapSlots: number
): WaterfallPlan {
    const { ticks, domain: valueDomain } = chooseTicks(
        waterfall.domain,
        tickCount
    )
    const { slots, totalSlot, groupRanges } = planStepAxis(
        waterfall.steps,
        groupHeaderSlots,
        boxGapSlots
    )
    const stepDomain: Span = { from: 0, to: totalSlot.to }

    const steps = waterfall.steps.map((step, index) =>
        planStep(step, slots[index], valueDomain)
    )
    const total = planStep(totalAsStep(waterfall.total), totalSlot, valueDomain)

    return {
        valueDomain,
        stepDomain,
        steps,
        total,
        connectors: planConnectors(steps),
        totalConnector: planTotalConnector(steps, total),
        ticks: ticks.map((value) => ({
            value,
            gridline: { value: { from: value, to: value }, step: stepDomain },
        })),
        zeroLine: { value: { from: 0, to: 0 }, step: stepDomain },
        groups: groupRanges.map(({ group, first, last }) => ({
            group,
            box: {
                value: valueDomain,
                step: {
                    from:
                        barSpan(slots[first]).from -
                        groupHeaderSlots -
                        GROUP_BOX_OVERHANG_RATIO,
                    to: barSpan(slots[last]).to + GROUP_BOX_OVERHANG_RATIO,
                },
            },
        })),
        totalBox: {
            value: valueDomain,
            step: {
                from:
                    totalSlot.from +
                    SLOT_PADDING_RATIO -
                    GROUP_BOX_OVERHANG_RATIO,
                to:
                    totalSlot.to -
                    SLOT_PADDING_RATIO +
                    GROUP_BOX_OVERHANG_RATIO,
            },
        },
    }
}

/** A placed group, as the indices of its first and last step */
interface GroupRange {
    group: StageGroup
    first: number
    last: number
}

/** Each step's slot and the total's, with the gap and header room before each group's first slot */
function planStepAxis(
    steps: WaterfallStep[],
    groupHeaderSlots: number,
    boxGapSlots: number
): { slots: Span[]; totalSlot: Span; groupRanges: GroupRange[] } {
    const groupRanges = findGroupRanges(steps)
    const groupStarts = new Set(groupRanges.map((range) => range.first))

    let cursor = 0
    const slots = steps.map((_, index) => {
        if (groupStarts.has(index)) cursor += boxGapSlots + groupHeaderSlots
        const slot = { from: cursor, to: cursor + 1 }
        cursor += 1
        return slot
    })
    cursor += boxGapSlots
    const totalSlot = { from: cursor, to: cursor + TOTAL_SLOT_SPAN }

    return { slots, totalSlot, groupRanges }
}

/** The groups whose stages are all side by side, in the order they appear */
function findGroupRanges(steps: WaterfallStep[]): GroupRange[] {
    const slotIndexByKey = new Map(
        steps.map((step, index) => [step.key, index])
    )

    return STAGE_GROUPS.flatMap((group) => {
        const slotIndices = group.stageKeys
            .map((key) => slotIndexByKey.get(key))
            .filter((index) => index !== undefined)
        if (slotIndices.length === 0) return []
        if (!areSlotsContiguous(slotIndices)) return []

        return [
            {
                group,
                first: Math.min(...slotIndices),
                last: Math.max(...slotIndices),
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
    return {
        key,
        name,
        direction: "in",
        delta: value,
        balanceBefore: 0,
        balanceAfter: value,
    }
}

function planStep(
    step: WaterfallStep,
    slot: Span,
    valueDomain: Span
): PlannedStep {
    return {
        step,
        slot: { value: valueDomain, step: slot },
        bar:
            step.delta === 0
                ? undefined
                : {
                      value: {
                          from: step.balanceBefore,
                          to: step.balanceAfter,
                      },
                      step: barSpan(slot),
                  },
        valueAnchor: {
            value: { from: step.balanceAfter, to: step.balanceAfter },
            step: slotCentre(slot),
        },
    }
}

/** One connector per adjacent pair of drawn bars, at the value they share */
function planConnectors(slots: PlannedStep[]): PlannedConnector[] {
    const stepsWithBars = slots.filter(
        (planned): planned is PlannedStep & { bar: Extent } =>
            planned.bar !== undefined
    )

    const connectors: PlannedConnector[] = []
    for (let i = 0; i < stepsWithBars.length - 1; i++) {
        const left = stepsWithBars[i]
        const right = stepsWithBars[i + 1]
        connectors.push({
            leftStep: left.step,
            line: {
                value: {
                    from: left.step.balanceAfter,
                    to: left.step.balanceAfter,
                },
                step: { from: left.bar.step.to, to: right.bar.step.from },
            },
        })
    }
    return connectors
}

function planTotalConnector(
    steps: PlannedStep[],
    total: PlannedStep
): Extent | undefined {
    const drawnSteps = steps.filter((planned) => planned.bar)
    const lastBar = drawnSteps[drawnSteps.length - 1]?.bar
    if (!lastBar || !total.bar) return undefined
    const value = total.step.balanceAfter
    return {
        value: { from: value, to: value },
        step: { from: lastBar.step.to, to: total.bar.step.from },
    }
}

/** Round tick values covering the domain, and the domain widened to reach them */
function chooseTicks(
    domain: [number, number],
    tickCount: number
): {
    ticks: number[]
    domain: Span
} {
    let [lo, hi] = domain
    if (lo === hi) {
        lo -= 1
        hi += 1
    }

    const step = tickStep(lo, hi, tickCount)
    const from = Math.floor(lo / step) * step
    const to = Math.ceil(hi / step) * step

    const count = Math.round((to - from) / step)
    const ticks: number[] = []
    for (let i = 0; i <= count; i++) ticks.push(from + i * step)

    return { ticks, domain: { from, to } }
}

/** Where a slot's bar goes: one slot wide less its padding, centred in the slot */
function barSpan(slot: Span): Span {
    const centre = slotCentre(slot).from
    const halfWidth = 0.5 - SLOT_PADDING_RATIO
    return { from: centre - halfWidth, to: centre + halfWidth }
}

/** The centre of a slot, as an interval whose ends coincide */
function slotCentre(slot: Span): Span {
    const centre = (slot.from + slot.to) / 2
    return { from: centre, to: centre }
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

/** Values run rightwards across the box, steps run down it */
const HORIZONTAL_PROJECTION: ScreenProjection = {
    axes: (box) => ({
        alongValue: { from: box.x, to: box.x + box.width },
        alongStep: { from: box.y, to: box.y + box.height },
    }),
    toSegment: (px) => ({
        x1: px.alongValue.from,
        y1: px.alongStep.from,
        x2: px.alongValue.to,
        y2: px.alongStep.to,
    }),
}

const PROJECTIONS: Record<WaterfallOrientation, ScreenProjection> = {
    vertical: VERTICAL_PROJECTION,
    horizontal: HORIZONTAL_PROJECTION,
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
        }
    }

    return {
        steps: plan.steps.map(placeStep),
        total: placeStep(plan.total),
        connectors: plan.connectors.map((planned) => ({
            leftStep: planned.leftStep,
            line: projection.toSegment(scaleExtent(planned.line, scales)),
        })),
        totalConnector:
            plan.totalConnector &&
            projection.toSegment(scaleExtent(plan.totalConnector, scales)),
        ticks: plan.ticks.map((tick) => ({
            value: tick.value,
            gridline: projection.toSegment(scaleExtent(tick.gridline, scales)),
        })),
        zeroLine: projection.toSegment(scaleExtent(plan.zeroLine, scales)),
        totalBox: toRect(
            projection.toSegment(scaleExtent(plan.totalBox, scales))
        ),
        groups: plan.groups.map((planned) => ({
            group: planned.group,
            box: toRect(projection.toSegment(scaleExtent(planned.box, scales))),
        })),
    }
}

/** Scales an extent to pixels, rounding the value axis to whole pixels */
function scaleExtent(
    extent: Extent,
    scales: { value: LinearScale; step: LinearScale }
): PxExtent {
    const alongValue = scaleSpan(extent.value, scales.value)
    return {
        alongValue: {
            from: Math.round(alongValue.from),
            to: Math.round(alongValue.to),
        },
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
