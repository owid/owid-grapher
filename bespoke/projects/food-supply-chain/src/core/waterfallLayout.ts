import { scaleLinear, ScaleLinear } from "d3-scale"
import { Box } from "@ourworldindata/types"
import { Point } from "@ourworldindata/utils"

import {
    ARROW_INSET,
    ARROW_MIN_LENGTH,
    COLORS,
    CONNECTOR_WIDTH,
} from "./constants.js"
import { STAGE_GROUPS, StageGroup } from "./stages.js"
import { Waterfall, WaterfallStep } from "./waterfall.js"

export const MIN_BAR_LENGTH_PX = 1

const SLOT_PADDING_RATIO = 0.15
const GROUP_BOX_OVERHANG_SLOTS = 0.08
const TOTAL_SLOT_SPAN = 1.5

const TICK_COUNT_BY_ORIENTATION: Record<WaterfallOrientation, number> = {
    vertical: 5,
    horizontal: 3,
}

export type WaterfallOrientation = "vertical" | "horizontal"

export interface WaterfallLayoutOptions {
    orientation?: WaterfallOrientation
    groupHeaderSlots?: number
    boxGapSlots?: number
}

export interface PlacedLine {
    x1: number
    y1: number
    x2: number
    y2: number
}

export interface PlacedStep {
    step: WaterfallStep
    slot: Box
    bar?: Box
    arrow?: PlacedLine
    valueAnchor: Point
}

export interface PlacedConnector {
    fromStep: WaterfallStep
    line: PlacedLine
}

export interface PlacedTick {
    value: number
    gridline: PlacedLine
}

export interface PlacedGroup {
    group: StageGroup
    isLabelled: boolean
    box: Box
}

export interface WaterfallLayout {
    steps: PlacedStep[]
    total: PlacedStep
    connectors: PlacedConnector[]
    totalConnector?: PlacedLine
    ticks: PlacedTick[]
    zeroLine: PlacedLine
    groups: PlacedGroup[]
    totalBox: Box
}

export function measureSlotWidth(plotWidth: number, stepCount: number): number {
    return plotWidth / (stepCount + TOTAL_SLOT_SPAN)
}

export function measureLabelledBoxLengths(steps: WaterfallStep[]): {
    groups: { group: StageGroup; boxLength: number }[]
    totalBoxLength: number
} {
    const { slots, totalSlot, groupRanges } = planStepAxis(steps, {
        groupHeaderSlots: 0,
        boxGapSlots: 0,
    })
    return {
        groups: groupRanges
            .filter((range) => range.isLabelled)
            .map(({ group, first, last }) => ({
                group,
                boxLength: measureSpanLength(
                    findBoxSpan(slots[first], slots[last])
                ),
            })),
        totalBoxLength: measureSpanLength(findBoxSpan(totalSlot, totalSlot)),
    }
}

export function chooseStepBackgroundColors(layout: WaterfallLayout): string[] {
    const groupedStepKeys = new Set(
        layout.groups.flatMap(({ group }) => group.stageKeys)
    )
    return layout.steps.map((placed) =>
        groupedStepKeys.has(placed.step.key)
            ? COLORS.groupBox
            : COLORS.background
    )
}

export function countStepAxisSlots(
    steps: WaterfallStep[],
    { groupHeaderSlots = 0, boxGapSlots = 0 }: WaterfallLayoutOptions
): number {
    return planStepAxis(steps, { groupHeaderSlots, boxGapSlots }).totalSlot.to
}

export function measureGroupHeaderSlots(
    headerHeightPx: number,
    slotLengthPx: number
): number {
    return (
        headerHeightPx / slotLengthPx -
        SLOT_PADDING_RATIO +
        GROUP_BOX_OVERHANG_SLOTS
    )
}

export function measureCaptionLength(slotWidth: number): number {
    return slotWidth * (1 - SLOT_PADDING_RATIO)
}

export function chooseTicks(
    domain: [number, number],
    orientation: WaterfallOrientation = "vertical"
): { ticks: number[]; domain: Span } {
    const tickCount = TICK_COUNT_BY_ORIENTATION[orientation]
    const [lo, hi] = domain
    const scale = scaleLinear()
        .domain(lo === hi ? [lo - 1, hi + 1] : [lo, hi])
        .nice(tickCount)
    const [from, to] = scale.domain()
    return { ticks: scale.ticks(tickCount), domain: { from, to } }
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
        planWaterfall(waterfall, orientation, groupHeaderSlots, boxGapSlots),
        box,
        PROJECTIONS[orientation]
    )
}

export interface Span {
    from: number
    to: number
}

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
    fromStep: WaterfallStep
    line: Extent
}

interface PlannedTick {
    value: number
    gridline: Extent
}

interface PlannedGroup {
    group: StageGroup
    isLabelled: boolean
    box: Extent
}

interface WaterfallPlan {
    valueDomain: Span
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
    orientation: WaterfallOrientation,
    groupHeaderSlots: number,
    boxGapSlots: number
): WaterfallPlan {
    const { ticks, domain: valueDomain } = chooseTicks(
        waterfall.domain,
        orientation
    )
    const { slots, totalSlot, groupRanges } = planStepAxis(waterfall.steps, {
        groupHeaderSlots,
        boxGapSlots,
    })
    const stepDomain: Span = { from: 0, to: totalSlot.to }

    const steps = waterfall.steps.map((step, index) =>
        planStep(step, slots[index], valueDomain)
    )
    const total = planStep(
        convertTotalToStep(waterfall.total),
        totalSlot,
        valueDomain
    )

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
        groups: groupRanges.map(({ group, first, last, isLabelled }) => ({
            group,
            isLabelled,
            box: {
                value: valueDomain,
                step: findBoxSpan(slots[first], slots[last]),
            },
        })),
        totalBox: {
            value: valueDomain,
            step: findBoxSpan(totalSlot, totalSlot),
        },
    }
}

interface GroupRange {
    group: StageGroup
    first: number
    last: number
    isLabelled: boolean
}

function planStepAxis(
    steps: WaterfallStep[],
    {
        groupHeaderSlots,
        boxGapSlots,
    }: Required<
        Pick<WaterfallLayoutOptions, "groupHeaderSlots" | "boxGapSlots">
    >
): { slots: Span[]; totalSlot: Span; groupRanges: GroupRange[] } {
    const groupRanges = findGroupRanges(steps)
    const groupRangeByStart = new Map(
        groupRanges.map((range) => [range.first, range])
    )

    const slots = steps.reduce<Span[]>((slots, _, index) => {
        const groupRange = groupRangeByStart.get(index)
        const gap = groupRange
            ? boxGapSlots + (groupRange.isLabelled ? groupHeaderSlots : 0)
            : 0
        const from = (slots.at(-1)?.to ?? 0) + gap
        return [...slots, { from, to: from + 1 }]
    }, [])
    const totalFrom = (slots.at(-1)?.to ?? 0) + boxGapSlots
    const totalSlot = { from: totalFrom, to: totalFrom + TOTAL_SLOT_SPAN }

    return { slots, totalSlot, groupRanges }
}

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
                isLabelled: slotIndices.length > 1,
            },
        ]
    })
}

function areSlotsContiguous(slotIndices: number[]): boolean {
    const first = Math.min(...slotIndices)
    const last = Math.max(...slotIndices)
    return last - first + 1 === slotIndices.length
}

function convertTotalToStep(total: Waterfall["total"]): WaterfallStep {
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
                      step: findBarSpan(slot),
                  },
        valueAnchor: {
            value: { from: step.balanceAfter, to: step.balanceAfter },
            step: findSlotCentre(slot),
        },
    }
}

function planConnectors(slots: PlannedStep[]): PlannedConnector[] {
    const stepsWithBars = slots.filter(
        (planned): planned is PlannedStep & { bar: Extent } =>
            planned.bar !== undefined
    )

    return stepsWithBars.slice(1).map((right, index) => {
        const left = stepsWithBars[index]
        return {
            fromStep: left.step,
            line: {
                value: {
                    from: left.step.balanceAfter,
                    to: left.step.balanceAfter,
                },
                step: { from: left.bar.step.to, to: right.bar.step.from },
            },
        }
    })
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

function findBarSpan(slot: Span): Span {
    const centre = findSlotCentre(slot).from
    const halfWidth = 0.5 - SLOT_PADDING_RATIO
    return { from: centre - halfWidth, to: centre + halfWidth }
}

function findBoxSpan(firstSlot: Span, lastSlot: Span): Span {
    return {
        from: firstSlot.from + SLOT_PADDING_RATIO - GROUP_BOX_OVERHANG_SLOTS,
        to: lastSlot.to - SLOT_PADDING_RATIO + GROUP_BOX_OVERHANG_SLOTS,
    }
}

function measureSpanLength(span: Span): number {
    return span.to - span.from
}

function findSlotCentre(slot: Span): Span {
    const centre = (slot.from + slot.to) / 2
    return { from: centre, to: centre }
}

interface PxExtent {
    alongValue: Span
    alongStep: Span
}

interface ScreenProjection {
    axes(box: Box): PxExtent
    toSegment(px: PxExtent): PlacedLine
}

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
        value: scaleSpanToSpan(plan.valueDomain, axes.alongValue),
        step: scaleSpanToSpan(plan.stepDomain, axes.alongStep),
    }

    const placeStep = (planned: PlannedStep): PlacedStep => {
        const barPx = planned.bar && scaleExtent(planned.bar, scales)
        const flooredBarPx = barPx && {
            alongValue: floorBarLength(
                barPx.alongValue,
                planned.step.delta,
                axes.alongValue
            ),
            alongStep: barPx.alongStep,
        }
        const arrowPx = flooredBarPx && placeBarArrow(flooredBarPx)

        return {
            step: planned.step,
            slot: toRect(
                projection.toSegment(scaleExtent(planned.slot, scales))
            ),
            bar: flooredBarPx && toRect(projection.toSegment(flooredBarPx)),
            arrow: arrowPx && projection.toSegment(arrowPx),
            valueAnchor: toPoint(
                projection.toSegment(scaleExtent(planned.valueAnchor, scales))
            ),
        }
    }

    return {
        steps: plan.steps.map(placeStep),
        total: placeStep(plan.total),
        connectors: plan.connectors.map((planned) => ({
            fromStep: planned.fromStep,
            line: projection.toSegment(
                shiftOntoFromBar(
                    scaleExtent(planned.line, scales),
                    planned.fromStep.delta,
                    axes.alongValue
                )
            ),
        })),
        totalConnector:
            plan.totalConnector &&
            projection.toSegment(
                shiftOntoFromBar(
                    scaleExtent(plan.totalConnector, scales),
                    plan.total.step.delta,
                    axes.alongValue
                )
            ),
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
            isLabelled: planned.isLabelled,
            box: toRect(projection.toSegment(scaleExtent(planned.box, scales))),
        })),
    }
}

function scaleExtent(
    extent: Extent,
    scales: {
        value: ScaleLinear<number, number>
        step: ScaleLinear<number, number>
    }
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

function scaleSpanToSpan(
    domain: Span,
    range: Span
): ScaleLinear<number, number> {
    return scaleLinear()
        .domain([domain.from, domain.to])
        .range([range.from, range.to])
}

function scaleSpan(span: Span, scale: ScaleLinear<number, number>): Span {
    return { from: scale(span.from), to: scale(span.to) }
}

function shiftOntoFromBar(
    connector: PxExtent,
    fromBarDelta: number,
    valueAxis: Span
): PxExtent {
    const towardsNearEnd =
        -Math.sign(valueAxis.to - valueAxis.from) * Math.sign(fromBarDelta)
    const shift = (towardsNearEnd * CONNECTOR_WIDTH) / 2
    return {
        alongValue: {
            from: connector.alongValue.from + shift,
            to: connector.alongValue.to + shift,
        },
        alongStep: connector.alongStep,
    }
}

function floorBarLength(bar: Span, delta: number, axis: Span): Span {
    const length = Math.abs(bar.to - bar.from)
    if (length >= MIN_BAR_LENGTH_PX) return bar

    const direction = Math.sign(axis.to - axis.from) * Math.sign(delta)
    const to = bar.from + direction * MIN_BAR_LENGTH_PX

    const axisMin = Math.min(axis.from, axis.to)
    const axisMax = Math.max(axis.from, axis.to)
    const spanMin = Math.min(bar.from, to)
    const spanMax = Math.max(bar.from, to)

    const overhang =
        spanMax > axisMax
            ? spanMax - axisMax
            : spanMin < axisMin
              ? spanMin - axisMin
              : 0

    return { from: bar.from - overhang, to: to - overhang }
}

function toRect(segment: PlacedLine): Box {
    return {
        x: Math.min(segment.x1, segment.x2),
        y: Math.min(segment.y1, segment.y2),
        width: Math.abs(segment.x2 - segment.x1),
        height: Math.abs(segment.y2 - segment.y1),
    }
}

function toPoint(segment: PlacedLine): Point {
    return { x: segment.x1, y: segment.y1 }
}

function placeBarArrow(bar: PxExtent): PxExtent | undefined {
    const { from, to } = bar.alongValue
    if (Math.abs(to - from) < ARROW_MIN_LENGTH + 2 * ARROW_INSET)
        return undefined

    const inset = Math.sign(to - from) * ARROW_INSET
    const centre = (bar.alongStep.from + bar.alongStep.to) / 2
    return {
        alongValue: { from: from + inset, to: to - inset },
        alongStep: { from: centre, to: centre },
    }
}
