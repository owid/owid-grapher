import cx from "clsx"

import { TextWrap } from "@ourworldindata/components/src/TextWrap/TextWrap.js"
import { TextWrapSvg } from "@ourworldindata/components/src/TextWrap/TextWrapComponents.js"
import { Halo } from "@ourworldindata/components/src/Halo/Halo.js"
import { Bounds } from "@ourworldindata/utils"
import { GrapherTooltipAnchor } from "@ourworldindata/types"
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
    CONNECTOR_WIDTH,
    GROUP_BOX_CORNER_RADIUS,
    GROUP_HEADER_GAP,
    GROUP_HEADER_INSET,
    GROUP_LABEL_FONT_SIZE,
    GROUP_LABEL_FONT_WEIGHT,
    GROUP_LABEL_INSET,
    LABEL_HALO_WIDTH,
    MAX_CAPTION_COLUMN_SHARE,
    MAX_ROW_CAPTION_LINES,
    MIN_ROW_HEIGHT,
    MIN_TICK_LABEL_SPACING,
    PLOT_MARGIN_BOTTOM,
    PLOT_MARGIN_RIGHT,
    ROW_PADDING,
    TICK_LABEL_FONT_SIZE,
    TICK_LABEL_GAP,
    TOTAL_BOX_LABEL_FONT_WEIGHT,
    TOTAL_LABEL_FONT_SIZE,
    TOTAL_LABEL_FONT_WEIGHT,
    VALUE_LABEL_FONT_SIZE,
    VALUE_LABEL_FONT_WEIGHT,
    VALUE_LABEL_LINE_HEIGHT,
    VALUE_LABEL_SIDE_GAP,
} from "../core/constants.js"
import {
    AxisLabel,
    fitAxisToLabels,
    LabelSide,
} from "../core/fitAxisToLabels.js"
import { formatMeasureValue } from "../core/format.js"
import { STAGE_GROUPS } from "../core/stageGroups.js"
import { isAddition, Waterfall } from "../core/waterfall.js"
import {
    Box,
    chooseTickValues,
    countStepAxisSlots,
    layOutWaterfall,
    measureGroupHeaderSlots,
    PlacedBar,
    PlacedLine,
    PlacedRect,
    PlacedStep,
} from "../core/waterfallLayout.js"
import { FoodSupplyChainTooltip } from "./FoodSupplyChainTooltip.js"
import { buildTruncatedTextWrap } from "./truncatedTextWrap.js"
import { useStepHover } from "./useStepHover.js"

/** How far short of its maxWidth a TextWrap breaks a line, see `TextWrap.lines` */
const TEXT_WRAP_BREAK_MARGIN = 10

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

    const span = waterfall.domain[1] - waterfall.domain[0]
    const tickValues = chooseTickValues(waterfall.domain, "horizontal")
    const tickLabels = tickValues.map((value, index) =>
        formatMeasureValue(value, {
            span,
            unit:
                index === tickValues.length - 1
                    ? waterfall.shortUnit
                    : undefined,
        })
    )
    const lastTickLabelWidth = Bounds.forText(
        tickLabels[tickLabels.length - 1],
        {
            fontSize: TICK_LABEL_FONT_SIZE,
        }
    ).width
    const stepValueLabelTexts = waterfall.steps.map((step, index) =>
        formatMeasureValue(step.delta, {
            span,
            unit: waterfall.shortUnit,
            showPlus: index > 0 && step.delta !== 0,
        })
    )
    const wrappedStepValueLabelLines = waterfall.steps.map((step, index) =>
        waterfall.isUnitWrappable
            ? [
                  formatMeasureValue(step.delta, {
                      span,
                      showPlus: index > 0 && step.delta !== 0,
                  }),
                  waterfall.shortUnit,
              ]
            : undefined
    )
    const totalValueLabelText = formatMeasureValue(waterfall.total.value, {
        span,
        unit: waterfall.shortUnit,
    })

    const longestCaptionWidth = Math.max(
        ...waterfall.steps.map(
            (step) =>
                buildRowCaptionTextWrap(
                    step.name,
                    Infinity,
                    CAPTION_FONT_WEIGHT
                ).width
        ),
        buildRowCaptionTextWrap(
            waterfall.total.name,
            Infinity,
            TOTAL_BOX_LABEL_FONT_WEIGHT
        ).width
    )
    const captionColumnWidth = Math.min(
        GROUP_LABEL_INSET + longestCaptionWidth + CAPTION_COLUMN_GAP,
        MAX_CAPTION_COLUMN_SHARE * width
    )
    const captionMaxWidth =
        captionColumnWidth -
        GROUP_LABEL_INSET -
        CAPTION_COLUMN_GAP +
        TEXT_WRAP_BREAK_MARGIN
    const valueAxis = fitAxisToLabels(
        [
            ...waterfall.steps.map((step, index) =>
                buildAxisLabel({
                    from: step.balanceBefore,
                    to: step.balanceAfter,
                    text: stepValueLabelTexts[index],
                    wrappedLines: wrappedStepValueLabelLines[index],
                    isTotal: false,
                    preferredSide: isAddition(step) ? "right" : "left",
                    tickValues,
                })
            ),
            buildAxisLabel({
                from: 0,
                to: waterfall.total.value,
                text: totalValueLabelText,
                isTotal: true,
                preferredSide: "right",
                tickValues,
            }),
        ],
        width - captionColumnWidth,
        Math.max(PLOT_MARGIN_RIGHT, lastTickLabelWidth / 2)
    )
    if (captionMaxWidth <= TEXT_WRAP_BREAK_MARGIN || valueAxis.length <= 0)
        return null

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
        STAGE_GROUPS.map((group) => [
            group.key,
            buildTruncatedTextWrap({
                text: group.label,
                maxWidth: width - 2 * GROUP_LABEL_INSET,
                maxLines: 1,
                fontSize: GROUP_LABEL_FONT_SIZE,
                fontWeight: GROUP_LABEL_FONT_WEIGHT,
            }),
        ])
    )
    const groupHeaderHeight =
        GROUP_HEADER_INSET +
        Math.max(
            ...[...groupHeaderTextWraps.values()].map((wrap) => wrap.height)
        ) +
        GROUP_HEADER_GAP
    const stepAxisSpacing = {
        groupHeaderSlots: measureGroupHeaderSlots(groupHeaderHeight, rowHeight),
        boxGapSlots: BOX_GAP / rowHeight,
    }

    const plotTop = TICK_LABEL_FONT_SIZE + TICK_LABEL_GAP
    const box: Box = {
        x: captionColumnWidth,
        y: plotTop,
        width: valueAxis.length,
        height:
            rowHeight * countStepAxisSlots(waterfall.steps, stepAxisSpacing),
    }
    const height = box.y + box.height + PLOT_MARGIN_BOTTOM
    const layout = layOutWaterfall(waterfall, box, {
        orientation: "horizontal",
        ...stepAxisSpacing,
    })

    const groupedStepKeys = new Set(
        layout.groups.flatMap(({ group }) => group.stageKeys)
    )
    const captionRight = captionColumnWidth - CAPTION_COLUMN_GAP
    const shownTickLabelIndices = chooseShownTickLabels(
        layout.ticks.map((tick) => tick.gridline.x1),
        tickLabels.map(
            (label) =>
                Bounds.forText(label, { fontSize: TICK_LABEL_FONT_SIZE }).width
        )
    )
    const hoveredStep = hover
        ? [...layout.steps, layout.total].find(
              (step) => step.step.key === hover.stepKey
          )
        : undefined

    return (
        <div ref={containerRef}>
            <svg
                ref={svgRef}
                className="food-supply-chain-waterfall food-supply-chain-waterfall--horizontal"
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
                {layout.ticks.map((tick, index) => (
                    <g key={tick.value}>
                        <line
                            className="food-supply-chain-waterfall__gridline"
                            x1={tick.gridline.x1}
                            y1={tick.gridline.y1}
                            x2={tick.gridline.x2}
                            y2={tick.gridline.y2}
                            stroke={COLORS.gridline}
                        />
                        {shownTickLabelIndices.has(index) && (
                            <text
                                className="food-supply-chain-waterfall__tick-label"
                                x={tick.gridline.x1}
                                y={tick.gridline.y1}
                                dy={-TICK_LABEL_GAP}
                                textAnchor="middle"
                                fontSize={TICK_LABEL_FONT_SIZE}
                                fill={COLORS.tickLabel}
                            >
                                {tickLabels[index]}
                            </text>
                        )}
                    </g>
                ))}
                <line
                    className="food-supply-chain-waterfall__zero-line"
                    x1={layout.zeroLine.x1}
                    y1={layout.zeroLine.y1}
                    x2={layout.zeroLine.x2}
                    y2={layout.zeroLine.y2}
                    stroke={COLORS.zeroLine}
                />
                {layout.connectors.map((connector, index) => (
                    <Connector
                        key={index}
                        line={connector.line}
                        isAddition={connector.leftStep.delta > 0}
                        color={
                            connector.leftStep.delta > 0
                                ? COLORS.add
                                : COLORS.subtract
                        }
                        isDimmed={hover !== undefined}
                    />
                ))}
                {layout.totalConnector && (
                    <Connector
                        line={layout.totalConnector}
                        isAddition={waterfall.total.value > 0}
                        color={COLORS.total}
                        isDimmed={hover !== undefined}
                    />
                )}
                {layout.groups.map(({ group, box: groupBox, isLabelled }) => {
                    const textWrap = groupHeaderTextWraps.get(group.key)
                    if (!isLabelled || !textWrap) return null
                    return (
                        <Halo
                            key={group.key}
                            id={`${group.key}-group-label-halo`}
                            outlineColor={COLORS.groupBox}
                            outlineWidth={LABEL_HALO_WIDTH}
                        >
                            <TextWrapSvg
                                className="food-supply-chain-waterfall__group-label"
                                textWrap={textWrap}
                                x={GROUP_LABEL_INSET}
                                y={groupBox.y + GROUP_HEADER_INSET}
                                fill={COLORS.groupLabel}
                            />
                        </Halo>
                    )
                })}
                {layout.steps.map((step, index) => (
                    <RowMarks
                        key={step.step.key}
                        step={step}
                        captionTextWrap={captionTextWraps[index]}
                        valueLabelLines={
                            (valueAxis.isWrapped[index] &&
                                wrappedStepValueLabelLines[index]) || [
                                stepValueLabelTexts[index],
                            ]
                        }
                        valueLabelSide={valueAxis.sides[index]}
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
                    valueLabelLines={[totalValueLabelText]}
                    valueLabelSide={valueAxis.sides[waterfall.steps.length]}
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
            {hover && hoveredStep && (
                <FoodSupplyChainTooltip
                    step={hoveredStep}
                    isTotal={hover.stepKey === waterfall.total.key}
                    isFirstStep={hover.stepKey === waterfall.steps[0]?.key}
                    unit={waterfall.shortUnit}
                    year={waterfall.year}
                    span={span}
                    position={hover.position}
                    containerBounds={isPinned ? undefined : { width, height }}
                    anchor={isPinned ? GrapherTooltipAnchor.Bottom : undefined}
                />
            )}
        </div>
    )
}

function RowMarks({
    step,
    captionTextWrap,
    valueLabelLines,
    valueLabelSide,
    isTotal,
    showArrow,
    isDimmed,
    captionRight,
    backgroundColor,
}: {
    step: PlacedStep
    captionTextWrap: TextWrap
    /** One line, or two with the unit on the second */
    valueLabelLines: string[]
    valueLabelSide: LabelSide
    isTotal: boolean
    showArrow: boolean
    isDimmed: boolean
    /** Where the caption's lines end */
    captionRight: number
    /** What the value label sits on, which its halo takes the colour of */
    backgroundColor: string
}): React.ReactElement {
    const barColor = isTotal
        ? COLORS.total
        : step.step.delta === 0
          ? COLORS.unchanged
          : isAddition(step.step)
          ? COLORS.add
          : COLORS.subtract
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
                    lines={valueLabelLines}
                    bar={step.bar ?? { x: step.valueAnchor.x, width: 0 }}
                    side={valueLabelSide}
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

/** A line from one bar to the next, shifted half its width onto the upper bar's side of their shared edge */
function Connector({
    line,
    isAddition,
    color,
    isDimmed,
}: {
    line: PlacedLine
    /** Whether the bar it leaves adds to the balance, which decides the side it shifts to */
    isAddition: boolean
    color: string
    isDimmed: boolean
}): React.ReactElement {
    // An addition's bar lies left of its far end on screen, a subtraction's right
    const x = line.x1 + ((isAddition ? -1 : 1) * CONNECTOR_WIDTH) / 2
    return (
        <line
            className={cx(
                "food-supply-chain-waterfall__connector",
                isDimmed && "food-supply-chain-waterfall__connector--dimmed"
            )}
            x1={x}
            y1={line.y1}
            x2={x}
            y2={line.y2}
            stroke={color}
            strokeWidth={CONNECTOR_WIDTH}
        />
    )
}

/** An arrow through the bar, pointing the way the balance moves; drawn only if the bar has room for it */
function BarArrow({
    step,
    bar,
}: {
    step: PlacedStep
    bar: PlacedBar
}): React.ReactElement | null {
    if (bar.width < ARROW_MIN_LENGTH + 2 * ARROW_INSET) return null

    // +1 walks right from the far end, -1 walks left
    const direction = step.step.delta > 0 ? -1 : 1
    const { x: farEndX } = step.valueAnchor
    const y = bar.y + bar.height / 2
    return (
        <BezierArrow
            className="food-supply-chain-waterfall__arrow"
            start={{ x: farEndX + direction * (bar.width - ARROW_INSET), y }}
            end={{ x: farEndX + direction * ARROW_INSET, y }}
            width={ARROW_WIDTH}
            color={COLORS.arrow}
            opacity={ARROW_OPACITY}
        />
    )
}

/** A bar's value label beside it, its lines centred on the row */
function ValueLabel({
    lines,
    bar,
    side,
    rowCentre,
    fontSize,
    fontWeight,
    fill,
    style,
}: {
    lines: string[]
    /** Zero-width at the running balance for a step with no bar */
    bar: Pick<PlacedRect, "x" | "width">
    side: LabelSide
    rowCentre: number
    fontSize: number
    fontWeight: number
    fill: string
    /** Set by Halo on its copy */
    style?: React.CSSProperties
}): React.ReactElement {
    const { x, textAnchor } = placeValueLabel(bar, side)
    const lineHeight = fontSize * VALUE_LABEL_LINE_HEIGHT
    return (
        <text
            className="food-supply-chain-waterfall__value-label"
            textAnchor={textAnchor}
            dominantBaseline="middle"
            fontSize={fontSize}
            fontWeight={fontWeight}
            fill={fill}
            style={style}
        >
            {lines.map((line, index) => (
                <tspan
                    key={index}
                    x={x}
                    y={
                        rowCentre +
                        (index - (lines.length - 1) / 2) * lineHeight
                    }
                >
                    {line}
                </tspan>
            ))}
        </text>
    )
}

function placeValueLabel(
    bar: Pick<PlacedRect, "x" | "width">,
    side: LabelSide
): { x: number; textAnchor: "start" | "end" } {
    return side === "right"
        ? { x: bar.x + bar.width + VALUE_LABEL_SIDE_GAP, textAnchor: "start" }
        : { x: bar.x - VALUE_LABEL_SIDE_GAP, textAnchor: "end" }
}

/** A value label as the room it needs beside a bar running from `from` to `to` */
function buildAxisLabel({
    from,
    to,
    text,
    wrappedLines,
    isTotal,
    preferredSide,
    tickValues,
}: {
    from: number
    to: number
    text: string
    /** The text as two lines, with the unit on the second */
    wrappedLines?: string[]
    isTotal: boolean
    preferredSide: LabelSide
    tickValues: number[]
}): AxisLabel {
    const domainStart = tickValues[0]
    const domainSpan = tickValues[tickValues.length - 1] - domainStart
    const measureTextWidth = (line: string): number =>
        Bounds.forText(line, {
            fontSize: isTotal ? TOTAL_LABEL_FONT_SIZE : VALUE_LABEL_FONT_SIZE,
            fontWeight: isTotal
                ? TOTAL_LABEL_FONT_WEIGHT
                : VALUE_LABEL_FONT_WEIGHT,
        }).width
    // a gap to the bar, and one to the plot's edge
    const gaps = 2 * VALUE_LABEL_SIDE_GAP
    return {
        barStart: (Math.min(from, to) - domainStart) / domainSpan,
        barEnd: (Math.max(from, to) - domainStart) / domainSpan,
        width: measureTextWidth(text) + gaps,
        wrappedWidth:
            wrappedLines &&
            Math.max(...wrappedLines.map(measureTextWidth)) + gaps,
        preferredSide,
    }
}

/**
 * The tick labels to draw, centred on the given positions: every one if none
 * overlap, else every other one, and so on, always keeping the last
 */
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
