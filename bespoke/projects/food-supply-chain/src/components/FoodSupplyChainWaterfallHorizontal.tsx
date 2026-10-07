import { useMemo } from "react"

import { TextWrap } from "@ourworldindata/components/src/TextWrap/TextWrap.js"
import { TextWrapSvg } from "@ourworldindata/components/src/TextWrap/TextWrapComponents.js"
import { Halo } from "@ourworldindata/components/src/Halo/Halo.js"
import { Bounds } from "@ourworldindata/utils"
import { Box } from "@ourworldindata/types"
import { BezierArrow } from "@ourworldindata/grapher"

import {
    ARROW_INSET,
    ARROW_MIN_LENGTH,
    ARROW_OPACITY,
    ARROW_WIDTH,
    BOX_GAP,
    CAPTION_COLUMN_GAP,
    CAPTION_FONT_SIZE,
    CAPTION_FONT_WEIGHT,
    COLORS,
    GROUP_BOX_CORNER_RADIUS,
    GROUP_HEADER_GAP,
    GROUP_HEADER_TOP_GAP,
    GROUP_LABEL_FONT_WEIGHT,
    GROUP_LABEL_INSET,
    LABEL_HALO_WIDTH,
    MAX_CAPTION_COLUMN_SHARE,
    MAX_ROW_CAPTION_LINES,
    MIN_ROW_HEIGHT,
    MIN_TICK_LABEL_SPACING,
    PLOT_MARGIN_BOTTOM,
    ROW_PADDING,
    TICK_LABEL_FONT_SIZE,
    TICK_LABEL_GAP,
    TOTAL_BOX_LABEL_FONT_WEIGHT,
    TOTAL_LABEL_FONT_SIZE,
    TOTAL_LABEL_FONT_WEIGHT,
    VALUE_LABEL_BASELINE_OFFSET,
    VALUE_LABEL_FONT_SIZE,
    VALUE_LABEL_FONT_WEIGHT,
    VALUE_LABEL_SIDE_GAP,
} from "../core/constants.js"
import {
    buildTruncatedTextWrap,
    formatMeasureValue,
    formatStepDelta,
} from "../core/text.js"
import { useStepHover } from "../core/useStepHover.js"
import { STAGE_GROUPS } from "../core/stages.js"
import { StageKey } from "../core/types.js"
import { chooseStepColor, Waterfall } from "../core/waterfall.js"
import {
    AxisLabel,
    chooseTicks,
    countStepAxisSlots,
    findGroupedStepKeys,
    fitAxisToLabels,
    layOutWaterfall,
    measureGroupHeaderSlots,
    measureLabelledBoxLengths,
    PlacedStep,
    Span,
    WaterfallLayout,
} from "../core/waterfallLayout.js"
import { FoodSupplyChainTooltip } from "./FoodSupplyChainTooltip.js"
import { FoodSupplyChainConnectors } from "./FoodSupplyChainConnectors.js"

export interface FoodSupplyChainWaterfallHorizontalProps {
    waterfall: Waterfall
    width: number
}

/** The waterfall as rows running rightwards, as tall as its rows need */
export function FoodSupplyChainWaterfallHorizontal({
    waterfall,
    width,
}: FoodSupplyChainWaterfallHorizontalProps): React.ReactElement | null {
    const {
        svgRef,
        containerRef,
        hover,
        isPinned,
        onStepMouseEnter,
        onStepMouseMove,
        onStepMouseLeave,
    } = useStepHover()

    const plan = useMemo(
        () => planHorizontalWaterfall(waterfall, width),
        [waterfall, width]
    )
    if (!plan) return null
    const {
        tickLabels,
        stepValueLabelTexts,
        totalValueLabelText,
        captionTextWraps,
        totalCaptionTextWrap,
        captionRight,
        groupHeaderTextWraps,
        height,
        layout,
        groupedStepKeys,
    } = plan

    return (
        <div ref={containerRef}>
            <svg
                ref={svgRef}
                className="food-supply-chain-waterfall"
                width={width}
                height={height}
                viewBox={`0 0 ${width} ${height}`}
            >
                {layout.groups.map(({ group, box: groupBox }) => (
                    <rect
                        key={group.key}
                        className="food-supply-chain-waterfall__group-box"
                        x={0}
                        y={groupBox.y}
                        width={width}
                        height={groupBox.height}
                        rx={GROUP_BOX_CORNER_RADIUS}
                        fill={COLORS.groupBox}
                    />
                ))}
                <rect
                    className="food-supply-chain-waterfall__group-box"
                    x={0}
                    y={layout.totalBox.y}
                    width={width}
                    height={layout.totalBox.height}
                    rx={GROUP_BOX_CORNER_RADIUS}
                    fill={COLORS.totalBox}
                />
                {layout.ticks.map((tick) => (
                    <g key={tick.value}>
                        <line
                            className="food-supply-chain-waterfall__gridline"
                            x1={tick.gridline.x1}
                            y1={tick.gridline.y1}
                            x2={tick.gridline.x2}
                            y2={tick.gridline.y2}
                            stroke={COLORS.gridline}
                        />
                        {tickLabels.has(tick.value) && (
                            <text
                                className="food-supply-chain-waterfall__tick-label"
                                x={tick.gridline.x1}
                                y={tick.gridline.y1}
                                dy={-TICK_LABEL_GAP}
                                textAnchor="middle"
                                fontSize={TICK_LABEL_FONT_SIZE}
                                fill={COLORS.tickLabel}
                            >
                                {tickLabels.get(tick.value)}
                            </text>
                        )}
                    </g>
                ))}
                <FoodSupplyChainConnectors
                    layout={layout}
                    isDimmed={hover !== undefined}
                />
                {layout.groups.map(({ group, box: groupBox }) => {
                    const textWrap = groupHeaderTextWraps.get(group.key)
                    if (!textWrap) return null
                    return (
                        <TextWrapSvg
                            key={group.key}
                            className="food-supply-chain-waterfall__group-label"
                            textWrap={textWrap}
                            x={0}
                            y={groupBox.y - GROUP_HEADER_GAP - textWrap.height}
                            fill={COLORS.groupLabel}
                        />
                    )
                })}
                {layout.steps.map((step, index) => (
                    <RowMarks
                        key={step.step.key}
                        step={step}
                        captionTextWrap={captionTextWraps[index]}
                        valueLabelText={stepValueLabelTexts[index]}
                        isTotal={false}
                        showArrow={index > 0}
                        isDimmed={
                            hover !== undefined &&
                            hover.stepKey !== step.step.key
                        }
                        captionRight={captionRight}
                        backgroundColor={
                            groupedStepKeys.has(step.step.key)
                                ? COLORS.groupBox
                                : COLORS.background
                        }
                    />
                ))}
                <RowMarks
                    step={layout.total}
                    captionTextWrap={totalCaptionTextWrap}
                    valueLabelText={totalValueLabelText}
                    isTotal
                    showArrow={false}
                    isDimmed={
                        hover !== undefined &&
                        hover.stepKey !== waterfall.total.key
                    }
                    captionRight={captionRight}
                    backgroundColor={COLORS.totalBox}
                />
                {[...layout.steps, layout.total].map((step) => (
                    <rect
                        key={step.step.key}
                        className="food-supply-chain-waterfall__hit-area"
                        x={0}
                        y={step.slot.y}
                        width={width}
                        height={step.slot.height}
                        fill="transparent"
                        onMouseEnter={(event) =>
                            onStepMouseEnter(step.step.key, event)
                        }
                        onMouseMove={onStepMouseMove}
                        onMouseLeave={onStepMouseLeave}
                    />
                ))}
            </svg>
            {hover && (
                <FoodSupplyChainTooltip
                    waterfall={waterfall}
                    layout={layout}
                    hover={hover}
                    isPinned={isPinned}
                    width={width}
                    height={height}
                />
            )}
        </div>
    )
}

interface HorizontalWaterfallPlan {
    /** Only the tick labels that are shown, by tick value */
    tickLabels: Map<number, string>
    stepValueLabelTexts: string[]
    totalValueLabelText: string
    captionTextWraps: TextWrap[]
    totalCaptionTextWrap: TextWrap
    captionRight: number
    groupHeaderTextWraps: Map<string, TextWrap>
    /** One per step, then the total's */
    height: number
    layout: WaterfallLayout
    groupedStepKeys: Set<StageKey>
}

function planHorizontalWaterfall(
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
        Bounds.forText(text, { fontSize: CAPTION_FONT_SIZE, fontWeight }).width
    const longestCaptionWidth = Math.max(
        ...waterfall.steps.map((step) =>
            measureCaptionWidth(step.name, CAPTION_FONT_WEIGHT)
        ),
        measureCaptionWidth(waterfall.total.name, TOTAL_BOX_LABEL_FONT_WEIGHT)
    )
    const longestGroupLabelWidth = Math.max(
        ...STAGE_GROUPS.map((group) =>
            measureCaptionWidth(group.label, GROUP_LABEL_FONT_WEIGHT)
        )
    )
    const captionRight = Math.max(
        Math.min(
            GROUP_LABEL_INSET + longestCaptionWidth,
            MAX_CAPTION_COLUMN_SHARE * width - CAPTION_COLUMN_GAP
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
        TOTAL_BOX_LABEL_FONT_WEIGHT
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
        tickLabels: new Map(
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
        groupedStepKeys: findGroupedStepKeys(layout),
    }
}

function RowMarks({
    step,
    captionTextWrap,
    valueLabelText,
    isTotal,
    showArrow,
    isDimmed,
    captionRight,
    backgroundColor,
}: {
    step: PlacedStep
    captionTextWrap: TextWrap
    valueLabelText: string
    isTotal: boolean
    showArrow: boolean
    isDimmed: boolean
    captionRight: number
    backgroundColor: string
}): React.ReactElement {
    const barColor = chooseStepColor(step.step, isTotal)
    const rowCentre = step.slot.y + step.slot.height / 2
    const valueLabelFontSize = isTotal
        ? TOTAL_LABEL_FONT_SIZE
        : VALUE_LABEL_FONT_SIZE

    return (
        <g
            className={
                isDimmed
                    ? "food-supply-chain-waterfall__step--dimmed"
                    : undefined
            }
        >
            <TextWrapSvg
                className="food-supply-chain-waterfall__caption"
                textWrap={captionTextWrap}
                x={captionRight}
                y={rowCentre - captionTextWrap.height / 2}
                textAnchor="end"
                fill={isTotal ? COLORS.totalLabel : COLORS.caption}
            />
            {step.bar && (
                <>
                    <rect
                        className="food-supply-chain-waterfall__bar"
                        x={step.bar.x}
                        y={step.bar.y}
                        width={step.bar.width}
                        height={step.bar.height}
                        fill={barColor}
                    />
                    {showArrow && <BarArrow step={step} bar={step.bar} />}
                </>
            )}
            <Halo
                id={`${step.step.key}-value-label-halo`}
                outlineColor={backgroundColor}
                outlineWidth={LABEL_HALO_WIDTH}
            >
                <ValueLabel
                    text={valueLabelText}
                    bar={step.bar ?? { x: step.valueAnchor.x, width: 0 }}
                    rowCentre={rowCentre}
                    fontSize={valueLabelFontSize}
                    fontWeight={
                        isTotal
                            ? TOTAL_LABEL_FONT_WEIGHT
                            : VALUE_LABEL_FONT_WEIGHT
                    }
                    fill={barColor}
                />
            </Halo>
        </g>
    )
}

function BarArrow({
    step,
    bar,
}: {
    step: PlacedStep
    bar: Box
}): React.ReactElement | null {
    if (bar.width < ARROW_MIN_LENGTH + 2 * ARROW_INSET) return null

    const intoBarSign = step.step.delta > 0 ? -1 : 1
    const { x: farEndX } = step.valueAnchor
    const y = bar.y + bar.height / 2
    return (
        <BezierArrow
            className="food-supply-chain-waterfall__arrow"
            start={{ x: farEndX + intoBarSign * (bar.width - ARROW_INSET), y }}
            end={{ x: farEndX + intoBarSign * ARROW_INSET, y }}
            width={ARROW_WIDTH}
            color={COLORS.arrow}
            opacity={ARROW_OPACITY}
        />
    )
}

function ValueLabel({
    text,
    bar,
    rowCentre,
    fontSize,
    fontWeight,
    fill,
    id,
    style,
}: {
    text: string
    bar: Pick<Box, "x" | "width">
    rowCentre: number
    fontSize: number
    fontWeight: number
    fill: string
    /** Set by Halo on the outline copy it draws behind the label */
    id?: string
    style?: React.CSSProperties
}): React.ReactElement {
    return (
        <text
            id={id}
            style={style}
            className="food-supply-chain-waterfall__value-label"
            x={bar.x + bar.width + VALUE_LABEL_SIDE_GAP}
            y={rowCentre + fontSize * VALUE_LABEL_BASELINE_OFFSET}
            fontSize={fontSize}
            fontWeight={fontWeight}
            fill={fill}
        >
            {text}
        </text>
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
    const gaps = 2 * VALUE_LABEL_SIDE_GAP // one to the bar, one to the plot edge
    return {
        barEnd: (Math.max(from, to) - domainStart) / domainSpan,
        width: textWidth + gaps,
    }
}

function chooseShownTickLabels(
    positions: number[],
    labelWidths: number[]
): Set<number> {
    const lastIndex = positions.length - 1
    for (let stride = 1; stride <= lastIndex; stride++) {
        const shown = positions
            .map((_, index) => index)
            .filter((index) => (lastIndex - index) % stride === 0)
        const doLabelsOverlap = shown.some((index, i) => {
            const next = shown[i + 1]
            if (next === undefined) return false
            const rightEdge = positions[index] + labelWidths[index] / 2
            const nextLeftEdge = positions[next] - labelWidths[next] / 2
            return rightEdge + MIN_TICK_LABEL_SPACING > nextLeftEdge
        })
        if (!doLabelsOverlap) return new Set(shown)
    }
    return new Set([lastIndex])
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
        fontSize: CAPTION_FONT_SIZE,
        fontWeight,
    })
}

function buildGroupHeaderTextWrap(text: string, maxWidth: number): TextWrap {
    return buildTruncatedTextWrap({
        text,
        maxWidth,
        maxLines: 1,
        fontSize: CAPTION_FONT_SIZE,
        fontWeight: GROUP_LABEL_FONT_WEIGHT,
    })
}
