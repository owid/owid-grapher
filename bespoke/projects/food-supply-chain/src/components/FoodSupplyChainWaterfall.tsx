import { useMemo } from "react"

import {
    TEXT_WRAP_BREAK_MARGIN,
    TextWrap,
} from "@ourworldindata/components/src/TextWrap/TextWrap.js"
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
    CAPTION_FONT_WEIGHT,
    CAPTION_VALUE_LABEL_GAP,
    GROUP_BOX_CORNER_RADIUS,
    GROUP_LABEL_INSET,
    GROUP_LABEL_FONT_SIZE,
    GROUP_LABEL_FONT_WEIGHT,
    GROUP_LABEL_GAP,
    LABEL_HALO_WIDTH,
    MAX_CAPTION_LINES,
    MAX_CAPTION_OVERFLOW,
    MIN_VERTICAL_SLOT_WIDTH,
    MIN_LABEL_SPACING,
    COLORS,
    PLOT_MARGIN_BOTTOM,
    TICK_LABEL_FONT_SIZE,
    TICK_LABEL_GAP,
    TOTAL_LABEL_FONT_SIZE,
    TOTAL_LABEL_FONT_WEIGHT,
    VALUE_LABEL_FONT_SIZE,
    VALUE_LABEL_FONT_WEIGHT,
    VALUE_LABEL_GAP,
    VERTICAL_CAPTION_FONT_SIZE,
} from "../core/constants.js"
import { formatMeasureValue } from "../core/text.js"
import { STAGE_GROUPS } from "../core/stages.js"
import {
    NUM_DECIMAL_PLACES_BY_MEASURE,
    SHORT_UNIT_BY_MEASURE,
    StageKey,
} from "../core/types.js"
import { chooseStepColor, Waterfall } from "../core/waterfall.js"
import {
    captionLength,
    chooseTickValues,
    chooseValueDomain,
    groupBoxLength,
    isGroupLabelled,
    layOutWaterfall,
    measureSlotWidth,
    PlacedRect,
    PlacedStep,
    totalBoxLength,
    WaterfallLayout,
} from "../core/waterfallLayout.js"
import { FoodSupplyChainTooltip } from "./FoodSupplyChainTooltip.js"
import {
    buildTruncatedTextWrap,
    FoodSupplyChainConnector,
    useStepHover,
} from "./waterfallShared.js"

export interface FoodSupplyChainWaterfallProps {
    waterfall: Waterfall
    width: number
    height: number
}

export function FoodSupplyChainWaterfall({
    waterfall,
    width,
    height,
}: FoodSupplyChainWaterfallProps): React.ReactElement | null {
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
        () => planVerticalWaterfall(waterfall, width, height),
        [waterfall, width, height]
    )
    if (!plan) return null
    const {
        tickLabels,
        captionTextWraps,
        totalLabelTextWrap,
        groupLabelTextWraps,
        valueLabelTexts,
        totalValueLabelText,
        columnTop,
        layout,
        groupedStepKeys,
    } = plan

    const hoveredStep = hover
        ? [...layout.steps, layout.total].find(
              (step) => step.step.key === hover.stepKey
          )
        : undefined

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
                    <GroupBox
                        key={group.key}
                        box={groupBox}
                        labelTextWrap={groupLabelTextWraps.get(group.key)}
                        fill={COLORS.groupBox}
                        labelColor={COLORS.groupLabel}
                    />
                ))}
                <GroupBox
                    box={layout.totalBox}
                    labelTextWrap={totalLabelTextWrap}
                    fill={COLORS.totalBox}
                    labelColor={COLORS.totalLabel}
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
                        <text
                            className="food-supply-chain-waterfall__tick-label"
                            x={tick.gridline.x1}
                            y={tick.gridline.y1}
                            dx={-TICK_LABEL_GAP}
                            textAnchor="end"
                            dominantBaseline="middle"
                            fontSize={TICK_LABEL_FONT_SIZE}
                            fill={COLORS.tickLabel}
                        >
                            {tickLabels.get(tick.value)}
                        </text>
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
                    <FoodSupplyChainConnector
                        key={index}
                        line={connector.line}
                        color={
                            connector.fromStep.delta > 0
                                ? COLORS.add
                                : COLORS.subtract
                        }
                        isDimmed={hover !== undefined}
                    />
                ))}
                {layout.totalConnector && (
                    <FoodSupplyChainConnector
                        line={layout.totalConnector}
                        color={COLORS.total}
                        isDimmed={hover !== undefined}
                    />
                )}
                {layout.steps.map((step, index) => (
                    <StepMarks
                        key={step.step.key}
                        step={step}
                        valueLabelText={valueLabelTexts[index]}
                        isTotal={false}
                        showArrow={index > 0}
                        isDimmed={
                            hover !== undefined &&
                            hover.stepKey !== step.step.key
                        }
                        captionTextWrap={captionTextWraps[index]}
                        backgroundColor={
                            groupedStepKeys.has(step.step.key)
                                ? COLORS.groupBox
                                : COLORS.background
                        }
                    />
                ))}
                <StepMarks
                    step={layout.total}
                    valueLabelText={totalValueLabelText}
                    isTotal
                    showArrow={false}
                    isDimmed={
                        hover !== undefined &&
                        hover.stepKey !== waterfall.total.key
                    }
                    backgroundColor={COLORS.totalBox}
                />
                {[...layout.steps, layout.total].map((step) => (
                    <rect
                        key={step.step.key}
                        className="food-supply-chain-waterfall__hit-area"
                        x={step.slot.x}
                        y={columnTop}
                        width={step.slot.width}
                        height={step.slot.y + step.slot.height - columnTop}
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
                    year={waterfall.year}
                    measure={waterfall.measure}
                    position={hover.position}
                    containerBounds={isPinned ? undefined : { width, height }}
                    anchor={isPinned ? GrapherTooltipAnchor.Bottom : undefined}
                />
            )}
        </div>
    )
}

interface VerticalWaterfallPlan {
    tickLabels: Map<number, string>
    captionTextWraps: TextWrap[]
    totalLabelTextWrap: TextWrap
    groupLabelTextWraps: Map<string, TextWrap>
    valueLabelTexts: string[]
    totalValueLabelText: string
    columnTop: number
    layout: WaterfallLayout
    groupedStepKeys: Set<StageKey>
}

function planVerticalWaterfall(
    waterfall: Waterfall,
    width: number,
    height: number
): VerticalWaterfallPlan | undefined {
    const numDecimalPlaces = NUM_DECIMAL_PLACES_BY_MEASURE[waterfall.measure]
    const shortUnit = SHORT_UNIT_BY_MEASURE[waterfall.measure]
    const tickLabels = buildTickLabels(waterfall)
    const tickLabelWidth = measureTickLabelWidth(tickLabels)

    const plotWidth = width - tickLabelWidth
    if (plotWidth <= 0) return undefined

    const slotWidth = measureSlotWidth(plotWidth, waterfall.steps.length)
    const captionTextWraps = waterfall.steps.map((step) =>
        buildCaptionTextWrap(step.name, slotWidth)
    )
    const totalLabelTextWrap = buildGroupLabelTextWrap(
        waterfall.total.name,
        totalBoxLength(slotWidth) - 2 * GROUP_LABEL_INSET
    )

    const stepKeys = new Set(waterfall.steps.map((step) => step.key))
    const groupLabelTextWraps = new Map(
        STAGE_GROUPS.flatMap((group) => {
            const stageCount = group.stageKeys.filter((key) =>
                stepKeys.has(key)
            ).length
            if (!isGroupLabelled(stageCount)) return []
            return [
                [
                    group.key,
                    buildGroupLabelTextWrap(
                        group.label,
                        groupBoxLength(slotWidth, stageCount) -
                            2 * GROUP_LABEL_INSET
                    ),
                ] as const,
            ]
        })
    )

    const groupLabelHeight = Math.max(
        ...[...groupLabelTextWraps.values(), totalLabelTextWrap].map(
            (wrap) => wrap.height
        )
    )
    const formatStepValues = (unit?: string): string[] =>
        waterfall.steps.map((step, index) =>
            formatMeasureValue(step.delta, {
                numDecimalPlaces,
                unit,
                showPlus: index > 0 && step.delta !== 0,
            })
        )
    const stepValuesWithUnit = formatStepValues(shortUnit)
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
        : formatStepValues()
    const totalValueLabelText = formatMeasureValue(waterfall.total.value, {
        numDecimalPlaces,
        unit: shortUnit,
    })

    const columnTop = GROUP_LABEL_INSET + groupLabelHeight + GROUP_LABEL_GAP
    const plotBottom = height - PLOT_MARGIN_BOTTOM
    const plotHeight = measurePlotHeight({
        availableHeight: plotBottom - columnTop,
        valueDomain: chooseValueDomain(waterfall.domain),
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
    const groupedStepKeys = new Set(
        layout.groups.flatMap(({ group }) => group.stageKeys)
    )

    return {
        tickLabels,
        captionTextWraps,
        totalLabelTextWrap,
        groupLabelTextWraps,
        valueLabelTexts,
        totalValueLabelText,
        columnTop,
        layout,
        groupedStepKeys,
    }
}

/** Whether the vertical chart fits this width with every caption whole */
export function doesVerticalLayoutFit(
    waterfall: Waterfall,
    width: number
): boolean {
    const slotWidth = measureVerticalSlotWidth(waterfall, width)
    if (slotWidth < MIN_VERTICAL_SLOT_WIDTH) return false

    const maxWidth = captionLength(slotWidth)
    return waterfall.steps.every((step) => {
        const wrap = new TextWrap({
            text: step.name,
            maxWidth,
            fontSize: VERTICAL_CAPTION_FONT_SIZE,
            fontWeight: CAPTION_FONT_WEIGHT,
        })
        return (
            wrap.lineCount <= MAX_CAPTION_LINES &&
            wrap.width <= maxWidth + MAX_CAPTION_OVERFLOW
        )
    })
}

function measureVerticalSlotWidth(waterfall: Waterfall, width: number): number {
    const plotWidth = width - measureTickLabelWidth(buildTickLabels(waterfall))
    return measureSlotWidth(plotWidth, waterfall.steps.length)
}

function buildTickLabels(waterfall: Waterfall): Map<number, string> {
    const numDecimalPlaces = NUM_DECIMAL_PLACES_BY_MEASURE[waterfall.measure]
    const shortUnit = SHORT_UNIT_BY_MEASURE[waterfall.measure]
    return new Map(
        chooseTickValues(waterfall.domain).map((value) => [
            value,
            formatMeasureValue(value, {
                numDecimalPlaces,
                unit: shortUnit,
            }),
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

function StepMarks({
    step,
    valueLabelText,
    isTotal,
    showArrow,
    isDimmed,
    captionTextWrap,
    backgroundColor,
}: {
    step: PlacedStep
    valueLabelText: string
    isTotal: boolean
    showArrow: boolean
    isDimmed: boolean
    /** Absent for the total, whose box carries its label */
    captionTextWrap?: TextWrap
    backgroundColor: string
}): React.ReactElement {
    const barColor = chooseStepColor(step.step, isTotal)

    const labelX =
        step.slot.x + step.slot.width - captionLength(step.slot.width)

    return (
        <g
            className={
                isDimmed
                    ? "food-supply-chain-waterfall__step--dimmed"
                    : undefined
            }
        >
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
                <text
                    className="food-supply-chain-waterfall__value-label"
                    x={isTotal ? step.valueAnchor.x : labelX}
                    y={measureBarTop(step) - VALUE_LABEL_GAP}
                    textAnchor={isTotal ? "middle" : "start"}
                    fontSize={getValueLabelFontSize(isTotal)}
                    fontWeight={
                        isTotal
                            ? TOTAL_LABEL_FONT_WEIGHT
                            : VALUE_LABEL_FONT_WEIGHT
                    }
                    fill={barColor}
                >
                    {valueLabelText}
                </text>
            </Halo>
            {captionTextWrap && (
                <Halo
                    id={`${step.step.key}-caption-halo`}
                    outlineColor={backgroundColor}
                    outlineWidth={LABEL_HALO_WIDTH}
                >
                    <TextWrapSvg
                        className="food-supply-chain-waterfall__caption"
                        textWrap={captionTextWrap}
                        x={labelX}
                        y={placeCaptionTop(step, captionTextWrap.height)}
                        fill={COLORS.caption}
                    />
                </Halo>
            )}
        </g>
    )
}

function GroupBox({
    box,
    labelTextWrap,
    fill,
    labelColor,
}: {
    box: PlacedRect
    labelTextWrap: TextWrap | undefined
    fill: string
    labelColor: string
}): React.ReactElement {
    return (
        <g className="food-supply-chain-waterfall__group">
            <rect
                className="food-supply-chain-waterfall__group-box"
                x={box.x}
                y={0}
                width={box.width}
                height={box.y + box.height}
                rx={GROUP_BOX_CORNER_RADIUS}
                fill={fill}
            />
            {labelTextWrap && (
                <TextWrapSvg
                    className="food-supply-chain-waterfall__group-label"
                    textWrap={labelTextWrap}
                    x={box.x + GROUP_LABEL_INSET}
                    y={GROUP_LABEL_INSET}
                    fill={labelColor}
                />
            )}
        </g>
    )
}

function getValueLabelFontSize(isTotal: boolean): number {
    return isTotal ? TOTAL_LABEL_FONT_SIZE : VALUE_LABEL_FONT_SIZE
}

/** The tallest plot that keeps every bar's labels below the columns' top */
function measurePlotHeight({
    availableHeight,
    valueDomain: [from, to],
    labelledBarTops,
}: {
    availableHeight: number
    valueDomain: [number, number]
    labelledBarTops: { topValue: number; labelHeight: number }[]
}): number {
    return Math.min(
        availableHeight,
        ...labelledBarTops.flatMap(({ topValue, labelHeight }) => {
            const heightShare = (topValue - from) / (to - from)
            // A bar at the very bottom sets no limit, however tall its labels
            if (heightShare <= 0) return []
            return [(availableHeight - labelHeight) / heightShare]
        })
    )
}

const CAPTION_OFFSET =
    VALUE_LABEL_GAP + VALUE_LABEL_FONT_SIZE + CAPTION_VALUE_LABEL_GAP

function measureBarTop(step: PlacedStep): number {
    return step.bar?.y ?? step.valueAnchor.y
}

function placeCaptionTop(step: PlacedStep, captionHeight: number): number {
    return measureBarTop(step) - CAPTION_OFFSET - captionHeight
}

function BarArrow({
    step,
    bar,
}: {
    step: PlacedStep
    bar: PlacedRect
}): React.ReactElement | null {
    if (bar.height < ARROW_MIN_LENGTH + 2 * ARROW_INSET) return null

    const intoBarSign = step.step.delta > 0 ? 1 : -1
    const { x, y: farEndY } = step.valueAnchor
    return (
        <BezierArrow
            className="food-supply-chain-waterfall__arrow"
            start={{ x, y: farEndY + intoBarSign * (bar.height - ARROW_INSET) }}
            end={{ x, y: farEndY + intoBarSign * ARROW_INSET }}
            width={ARROW_WIDTH}
            color={COLORS.arrow}
            opacity={ARROW_OPACITY}
        />
    )
}

function buildGroupLabelTextWrap(text: string, maxWidth: number): TextWrap {
    return new TextWrap({
        text,
        maxWidth: maxWidth + TEXT_WRAP_BREAK_MARGIN,
        fontSize: GROUP_LABEL_FONT_SIZE,
        fontWeight: GROUP_LABEL_FONT_WEIGHT,
    })
}

function buildCaptionTextWrap(text: string, slotWidth: number): TextWrap {
    return buildTruncatedTextWrap({
        text,
        maxWidth: captionLength(slotWidth),
        maxLines: MAX_CAPTION_LINES,
        fontSize: VERTICAL_CAPTION_FONT_SIZE,
        fontWeight: CAPTION_FONT_WEIGHT,
    })
}
