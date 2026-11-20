import * as R from "remeda"

import { TextWrap } from "@ourworldindata/components/src/TextWrap/TextWrap.js"
import { Bounds } from "@ourworldindata/utils"
import { Box } from "@ourworldindata/types"

import {
    BOX_GAP,
    CAPTION_COLUMN_GAP,
    HORIZONTAL_CAPTION_FONT_SIZE,
    CAPTION_FONT_WEIGHT,
    GROUP_HEADER_GAP,
    GROUP_HEADER_TOP_GAP,
    GROUP_LABEL_FONT_WEIGHT,
    GROUP_LABEL_INSET,
    MAX_ROW_CAPTION_SHARE,
    MAX_ROW_CAPTION_LINES,
    MIN_ROW_HEIGHT,
    MIN_TICK_LABEL_SPACING,
    PLOT_MARGIN_BOTTOM,
    ROW_PADDING,
    TICK_LABEL_FONT_SIZE,
    TICK_LABEL_GAP,
    TOTAL_ROW_CAPTION_FONT_WEIGHT,
    TOTAL_LABEL_FONT_SIZE,
    TOTAL_LABEL_FONT_WEIGHT,
    VALUE_LABEL_FONT_SIZE,
    VALUE_LABEL_FONT_WEIGHT,
    VALUE_LABEL_SIDE_GAP,
} from "./constants.js"
import {
    buildTruncatedTextWrap,
    formatMeasureValue,
    formatStepDelta,
} from "./text.js"
import { STAGE_GROUPS } from "./stages.js"
import { Waterfall } from "./waterfall.js"
import {
    chooseStepBackgroundColors,
    chooseTicks,
    countStepAxisSlots,
    layOutWaterfall,
    measureGroupHeaderSlots,
    measureLabelledBoxLengths,
    Span,
    WaterfallLayout,
} from "./waterfallLayout.js"

export interface AxisLabel {
    barEndShare: number
    widthPx: number
}

export interface HorizontalWaterfallPlan {
    shownTickLabelsByValue: Map<number, string>
    stepValueLabelTexts: string[]
    totalValueLabelText: string
    captionTextWraps: TextWrap[]
    totalCaptionTextWrap: TextWrap
    captionRight: number
    groupHeaderTextWraps: Map<string, TextWrap>
    height: number
    layout: WaterfallLayout
    stepBackgroundColors: string[]
}

export function planHorizontalWaterfall(
    waterfall: Waterfall,
    width: number
): HorizontalWaterfallPlan | undefined {
    const { measure } = waterfall
    const { ticks: tickValues, domain: valueDomain } = chooseTicks(
        waterfall.domain,
        "horizontal"
    )
    const tickLabels = tickValues.map((value, index) =>
        formatMeasureValue(value, measure, {
            withUnit: index === tickValues.length - 1,
        })
    )
    const tickLabelWidths = tickLabels.map(
        (label) =>
            Bounds.forText(label, { fontSize: TICK_LABEL_FONT_SIZE }).width
    )
    const stepValueLabelTexts = waterfall.steps.map((step, index) =>
        formatStepDelta(step.delta, measure, { isFromZero: index === 0 })
    )
    const totalValueLabelText = formatMeasureValue(
        waterfall.total.value,
        measure
    )

    const measureCaptionWidth = (text: string, fontWeight: number): number =>
        Bounds.forText(text, {
            fontSize: HORIZONTAL_CAPTION_FONT_SIZE,
            fontWeight,
        }).width
    const longestCaptionWidth = Math.max(
        ...waterfall.steps.map((step) =>
            measureCaptionWidth(step.name, CAPTION_FONT_WEIGHT)
        ),
        measureCaptionWidth(waterfall.total.name, TOTAL_ROW_CAPTION_FONT_WEIGHT)
    )
    const longestGroupLabelWidth = Math.max(
        ...STAGE_GROUPS.map((group) =>
            measureCaptionWidth(group.label, GROUP_LABEL_FONT_WEIGHT)
        )
    )
    const captionRight = Math.max(
        Math.min(
            GROUP_LABEL_INSET + longestCaptionWidth,
            MAX_ROW_CAPTION_SHARE * width - CAPTION_COLUMN_GAP
        ),
        longestGroupLabelWidth
    )
    const captionColumnWidth = captionRight + CAPTION_COLUMN_GAP
    const captionMaxWidth = captionRight - GROUP_LABEL_INSET
    const valueAxisLength = fitAxisToLabels(
        [
            ...waterfall.steps.map((step, index) =>
                buildAxisLabel({
                    from: step.balanceBefore,
                    to: step.balanceAfter,
                    text: stepValueLabelTexts[index],
                    isTotal: false,
                    valueDomain,
                })
            ),
            buildAxisLabel({
                from: 0,
                to: waterfall.total.value,
                text: totalValueLabelText,
                isTotal: true,
                valueDomain,
            }),
        ],
        width - captionColumnWidth,
        tickLabelWidths[tickLabelWidths.length - 1] / 2
    )
    if (captionMaxWidth <= 0 || valueAxisLength <= 0) return undefined

    const captionTextWraps = waterfall.steps.map((step) =>
        buildRowCaptionTextWrap(step.name, captionMaxWidth, CAPTION_FONT_WEIGHT)
    )
    const totalCaptionTextWrap = buildRowCaptionTextWrap(
        waterfall.total.name,
        captionMaxWidth,
        TOTAL_ROW_CAPTION_FONT_WEIGHT
    )
    const rowHeight = Math.max(
        MIN_ROW_HEIGHT,
        ...[...captionTextWraps, totalCaptionTextWrap].map(
            (wrap) => wrap.height + 2 * ROW_PADDING
        )
    )

    const groupHeaderTextWraps = new Map(
        measureLabelledBoxLengths(waterfall.steps).groups.map(({ group }) => [
            group.key,
            buildGroupHeaderTextWrap(group.label, captionRight),
        ])
    )
    const groupHeaderHeight =
        Math.max(
            0,
            ...[...groupHeaderTextWraps.values()].map((wrap) => wrap.height)
        ) +
        GROUP_HEADER_GAP +
        GROUP_HEADER_TOP_GAP
    const stepAxisSpacing = {
        groupHeaderSlots: measureGroupHeaderSlots(groupHeaderHeight, rowHeight),
        boxGapSlots: BOX_GAP / rowHeight,
    }

    const plotTop = TICK_LABEL_FONT_SIZE + TICK_LABEL_GAP
    const box: Box = {
        x: captionColumnWidth,
        y: plotTop,
        width: valueAxisLength,
        height:
            rowHeight * countStepAxisSlots(waterfall.steps, stepAxisSpacing),
    }
    const height = box.y + box.height + PLOT_MARGIN_BOTTOM
    const layout = layOutWaterfall(waterfall, box, {
        orientation: "horizontal",
        ...stepAxisSpacing,
    })

    const shownTickLabelIndices = chooseShownTickLabels(
        layout.ticks.map((tick) => tick.gridline.x1),
        tickLabelWidths
    )

    return {
        shownTickLabelsByValue: new Map(
            tickValues.flatMap((value, index) =>
                shownTickLabelIndices.has(index)
                    ? [[value, tickLabels[index]] as const]
                    : []
            )
        ),
        stepValueLabelTexts,
        totalValueLabelText,
        captionTextWraps,
        totalCaptionTextWrap,
        captionRight,
        groupHeaderTextWraps,
        height,
        layout,
        stepBackgroundColors: chooseStepBackgroundColors(layout),
    }
}

export function fitAxisToLabels(
    labels: AxisLabel[],
    availableLength: number,
    endMargin: number
): number {
    const lengthsFittingLabels = labels
        .filter((label) => label.barEndShare > 0)
        .map((label) => (availableLength - label.widthPx) / label.barEndShare)
    return Math.max(
        0,
        Math.min(availableLength - endMargin, ...lengthsFittingLabels)
    )
}

function buildAxisLabel({
    from,
    to,
    text,
    isTotal,
    valueDomain: { from: domainStart, to: domainEnd },
}: {
    from: number
    to: number
    text: string
    isTotal: boolean
    valueDomain: Span
}): AxisLabel {
    const domainSpan = domainEnd - domainStart
    const textWidth = Bounds.forText(text, {
        fontSize: isTotal ? TOTAL_LABEL_FONT_SIZE : VALUE_LABEL_FONT_SIZE,
        fontWeight: isTotal ? TOTAL_LABEL_FONT_WEIGHT : VALUE_LABEL_FONT_WEIGHT,
    }).width
    const gaps = 2 * VALUE_LABEL_SIDE_GAP
    return {
        barEndShare: (Math.max(from, to) - domainStart) / domainSpan,
        widthPx: textWidth + gaps,
    }
}

function chooseShownTickLabels(
    positions: number[],
    labelWidths: number[]
): Set<number> {
    const lastIndex = positions.length - 1
    const pickEveryStrideFromEnd = (stride: number): number[] =>
        R.range(0, positions.length).filter(
            (index) => (lastIndex - index) % stride === 0
        )
    const doLabelsOverlap = (shown: number[]): boolean =>
        shown.some((index, i) => {
            const next = shown[i + 1]
            if (next === undefined) return false
            const rightEdge = positions[index] + labelWidths[index] / 2
            const nextLeftEdge = positions[next] - labelWidths[next] / 2
            return rightEdge + MIN_TICK_LABEL_SPACING > nextLeftEdge
        })

    const shown = R.range(1, lastIndex + 1)
        .map(pickEveryStrideFromEnd)
        .find((indices) => !doLabelsOverlap(indices))
    return new Set(shown ?? [lastIndex])
}

function buildRowCaptionTextWrap(
    text: string,
    maxWidth: number,
    fontWeight: number
): TextWrap {
    return buildTruncatedTextWrap({
        text,
        maxWidth,
        maxLines: MAX_ROW_CAPTION_LINES,
        fontSize: HORIZONTAL_CAPTION_FONT_SIZE,
        fontWeight,
    })
}

function buildGroupHeaderTextWrap(text: string, maxWidth: number): TextWrap {
    return buildTruncatedTextWrap({
        text,
        maxWidth,
        maxLines: 1,
        fontSize: HORIZONTAL_CAPTION_FONT_SIZE,
        fontWeight: GROUP_LABEL_FONT_WEIGHT,
    })
}
