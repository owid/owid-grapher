import { TextWrap } from "@ourworldindata/components/src/TextWrap/TextWrap.js"
import { Bounds } from "@ourworldindata/utils"

import {
    CAPTION_FONT_WEIGHT,
    CAPTION_VALUE_LABEL_GAP,
    GROUP_LABEL_INSET,
    VERTICAL_GROUP_LABEL_FONT_SIZE,
    GROUP_LABEL_FONT_WEIGHT,
    GROUP_LABEL_GAP,
    MAX_COLUMN_CAPTION_LINES,
    MAX_CAPTION_OVERFLOW,
    MIN_VERTICAL_SLOT_WIDTH,
    MIN_LABEL_SPACING,
    PLOT_MARGIN_BOTTOM,
    TICK_LABEL_FONT_SIZE,
    TICK_LABEL_GAP,
    TOTAL_LABEL_FONT_SIZE,
    VALUE_LABEL_FONT_SIZE,
    VALUE_LABEL_FONT_WEIGHT,
    VALUE_LABEL_GAP,
    VERTICAL_CAPTION_FONT_SIZE,
} from "./constants.js"
import {
    buildTruncatedTextWrap,
    formatMeasureValue,
    formatStepDelta,
} from "./text.js"
import { Waterfall } from "./waterfall.js"
import {
    chooseStepBackgroundColors,
    chooseTicks,
    layOutWaterfall,
    measureCaptionLength,
    measureLabelledBoxLengths,
    measureSlotWidth,
    PlacedStep,
    Span,
    WaterfallLayout,
} from "./waterfallLayout.js"

const CAPTION_OFFSET =
    VALUE_LABEL_GAP + VALUE_LABEL_FONT_SIZE + CAPTION_VALUE_LABEL_GAP

export interface VerticalWaterfallPlan {
    tickLabels: Map<number, string>
    captionTextWraps: TextWrap[]
    totalLabelTextWrap: TextWrap
    groupLabelTextWraps: Map<string, TextWrap>
    valueLabelTexts: string[]
    totalValueLabelText: string
    columnTop: number
    layout: WaterfallLayout
    stepBackgroundColors: string[]
}

export function planVerticalWaterfall(
    waterfall: Waterfall,
    width: number,
    height: number
): VerticalWaterfallPlan | undefined {
    const tickLabels = buildTickLabels(waterfall)
    const tickLabelWidth = measureTickLabelWidth(tickLabels)

    const plotWidth = width - tickLabelWidth
    if (plotWidth <= 0) return undefined

    const slotWidth = measureSlotWidth(plotWidth, waterfall.steps.length)
    const captionTextWraps = waterfall.steps.map((step) =>
        buildCaptionTextWrap(step.name, slotWidth)
    )
    const boxLengths = measureLabelledBoxLengths(waterfall.steps)
    const totalLabelTextWrap = buildGroupLabelTextWrap(
        waterfall.total.name,
        slotWidth * boxLengths.totalBoxLength - 2 * GROUP_LABEL_INSET
    )
    const groupLabelTextWraps = new Map(
        boxLengths.groups.map(({ group, boxLength }) => [
            group.key,
            buildGroupLabelTextWrap(
                group.label,
                slotWidth * boxLength - 2 * GROUP_LABEL_INSET
            ),
        ])
    )

    const groupLabelHeight = Math.max(
        ...[...groupLabelTextWraps.values(), totalLabelTextWrap].map(
            (wrap) => wrap.height
        )
    )
    const formatStepValues = (withUnit: boolean): string[] =>
        waterfall.steps.map((step, index) =>
            formatStepDelta(step.delta, waterfall.measure, {
                isFromZero: index === 0,
                withUnit,
            })
        )
    const stepValuesWithUnit = formatStepValues(true)
    const doStepValuesWithUnitFit = stepValuesWithUnit.every(
        (text) =>
            Bounds.forText(text, {
                fontSize: VALUE_LABEL_FONT_SIZE,
                fontWeight: VALUE_LABEL_FONT_WEIGHT,
            }).width +
                MIN_LABEL_SPACING <=
            slotWidth
    )
    const valueLabelTexts = doStepValuesWithUnitFit
        ? stepValuesWithUnit
        : formatStepValues(false)
    const totalValueLabelText = formatMeasureValue(
        waterfall.total.value,
        waterfall.measure
    )

    const columnTop = GROUP_LABEL_INSET + groupLabelHeight + GROUP_LABEL_GAP
    const plotBottom = height - PLOT_MARGIN_BOTTOM
    const plotHeight = measurePlotHeight({
        availableHeight: plotBottom - columnTop,
        valueDomain: chooseTicks(waterfall.domain).domain,
        labelledBarTops: [
            ...waterfall.steps.map((step, index) => ({
                topValue: Math.max(step.balanceBefore, step.balanceAfter),
                labelHeight: CAPTION_OFFSET + captionTextWraps[index].height,
            })),
            {
                topValue: Math.max(0, waterfall.total.value),
                labelHeight: VALUE_LABEL_GAP + TOTAL_LABEL_FONT_SIZE,
            },
        ],
    })

    if (plotHeight <= 0) return undefined

    const box = {
        x: tickLabelWidth,
        y: plotBottom - plotHeight,
        width: plotWidth,
        height: plotHeight,
    }
    const layout = layOutWaterfall(waterfall, box)

    return {
        tickLabels,
        captionTextWraps,
        totalLabelTextWrap,
        groupLabelTextWraps,
        valueLabelTexts,
        totalValueLabelText,
        columnTop,
        layout,
        stepBackgroundColors: chooseStepBackgroundColors(layout),
    }
}

export function doesVerticalLayoutFit(
    waterfall: Waterfall,
    width: number
): boolean {
    const slotWidth = measureVerticalSlotWidth(waterfall, width)
    if (slotWidth < MIN_VERTICAL_SLOT_WIDTH) return false

    const maxWidth = measureCaptionLength(slotWidth)
    return waterfall.steps.every((step) => {
        const wrap = new TextWrap({
            text: step.name,
            maxWidth,
            fontSize: VERTICAL_CAPTION_FONT_SIZE,
            fontWeight: CAPTION_FONT_WEIGHT,
        })
        return (
            wrap.lineCount <= MAX_COLUMN_CAPTION_LINES &&
            wrap.width <= maxWidth + MAX_CAPTION_OVERFLOW
        )
    })
}

export function measureBarTop(step: PlacedStep): number {
    return step.bar?.y ?? step.valueAnchor.y
}

export function placeCaptionTop(
    step: PlacedStep,
    captionHeight: number
): number {
    return measureBarTop(step) - CAPTION_OFFSET - captionHeight
}

function measureVerticalSlotWidth(waterfall: Waterfall, width: number): number {
    const plotWidth = width - measureTickLabelWidth(buildTickLabels(waterfall))
    return measureSlotWidth(plotWidth, waterfall.steps.length)
}

function buildTickLabels(waterfall: Waterfall): Map<number, string> {
    return new Map(
        chooseTicks(waterfall.domain).ticks.map((value) => [
            value,
            formatMeasureValue(value, waterfall.measure),
        ])
    )
}

function measureTickLabelWidth(tickLabels: Map<number, string>): number {
    return (
        Math.max(
            ...[...tickLabels.values()].map(
                (label) =>
                    Bounds.forText(label, { fontSize: TICK_LABEL_FONT_SIZE })
                        .width
            )
        ) + TICK_LABEL_GAP
    )
}

function measurePlotHeight({
    availableHeight,
    valueDomain: { from, to },
    labelledBarTops,
}: {
    availableHeight: number
    valueDomain: Span
    labelledBarTops: { topValue: number; labelHeight: number }[]
}): number {
    return Math.min(
        availableHeight,
        ...labelledBarTops.flatMap(({ topValue, labelHeight }) => {
            const heightShare = (topValue - from) / (to - from)
            if (heightShare <= 0) return []
            return [(availableHeight - labelHeight) / heightShare]
        })
    )
}

function buildGroupLabelTextWrap(text: string, maxWidth: number): TextWrap {
    return new TextWrap({
        text,
        maxWidth,
        fontSize: VERTICAL_GROUP_LABEL_FONT_SIZE,
        fontWeight: GROUP_LABEL_FONT_WEIGHT,
    })
}

function buildCaptionTextWrap(text: string, slotWidth: number): TextWrap {
    return buildTruncatedTextWrap({
        text,
        maxWidth: measureCaptionLength(slotWidth),
        maxLines: MAX_COLUMN_CAPTION_LINES,
        fontSize: VERTICAL_CAPTION_FONT_SIZE,
        fontWeight: CAPTION_FONT_WEIGHT,
    })
}
