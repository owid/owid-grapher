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
    CAPTION_FONT_SIZE,
    CAPTION_FONT_WEIGHT,
    CAPTION_VALUE_LABEL_GAP,
    CONNECTOR_WIDTH,
    GROUP_BOX_CORNER_RADIUS,
    GROUP_LABEL_INSET,
    GROUP_LABEL_FONT_SIZE,
    GROUP_LABEL_FONT_WEIGHT,
    GROUP_LABEL_GAP,
    LABEL_HALO_WIDTH,
    MAX_CAPTION_LINES,
    MIN_LABEL_SPACING,
    COLORS,
    PLOT_MARGIN_BOTTOM,
    PLOT_MARGIN_RIGHT,
    TICK_LABEL_FONT_SIZE,
    TICK_LABEL_GAP,
    TOTAL_LABEL_FONT_SIZE,
    TOTAL_LABEL_FONT_WEIGHT,
    VALUE_LABEL_FONT_SIZE,
    VALUE_LABEL_FONT_WEIGHT,
    VALUE_LABEL_GAP,
} from "../core/constants.js"
import { formatMeasureValue } from "../core/format.js"
import { STAGE_GROUPS } from "../core/stageGroups.js"
import { isAddition, Waterfall } from "../core/waterfall.js"
import {
    captionLength,
    chooseTickValues,
    groupBoxLength,
    layOutWaterfall,
    measureSlotWidth,
    PlacedBar,
    PlacedConnector,
    PlacedRect,
    PlacedStep,
    totalBoxLength,
} from "../core/waterfallLayout.js"
import { FoodSupplyChainTooltip } from "./FoodSupplyChainTooltip.js"
import { buildTruncatedTextWrap } from "./truncatedTextWrap.js"
import { useStepHover } from "./useStepHover.js"

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

    const span = waterfall.domain[1] - waterfall.domain[0]
    const tickLabels = buildTickLabels(waterfall)
    const axisLabelWidth = measureAxisLabelWidth(tickLabels)

    const plotWidth = width - axisLabelWidth - PLOT_MARGIN_RIGHT
    if (plotWidth <= 0) return null

    const slotWidth = measureSlotWidth(plotWidth, waterfall.steps.length)
    const captionTextWraps = waterfall.steps.map((step) =>
        buildCaptionTextWrap(step.name, slotWidth)
    )
    const totalLabelTextWrap = buildGroupLabelTextWrap(
        waterfall.total.name,
        totalBoxLength(slotWidth) - 2 * GROUP_LABEL_INSET
    )

    const groupLabelTextWraps = new Map(
        STAGE_GROUPS.map((group) => [
            group.key,
            buildGroupLabelTextWrap(
                group.label,
                groupBoxLength(slotWidth, group.stageKeys.length) -
                    2 * GROUP_LABEL_INSET
            ),
        ])
    )

    const groupLabelHeight = Math.max(
        ...[...groupLabelTextWraps.values(), totalLabelTextWrap].map(
            (wrap) => wrap.height
        )
    )
    const formatStepValues = (unit?: string): string[] =>
        waterfall.steps.map((step) =>
            formatMeasureValue(step.delta, { span, unit, showPlus: true })
        )
    const stepValuesWithUnit = formatStepValues(waterfall.shortUnit)
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
        span,
        unit: waterfall.shortUnit,
    })

    const clearanceAboveBars = Math.max(
        ...waterfall.steps.map(
            (step, index) =>
                measureCaptionOffset() + captionTextWraps[index].height
        ),
        VALUE_LABEL_GAP + TOTAL_LABEL_FONT_SIZE
    )

    const groupBoxTop = 0
    const groupLabelY = groupBoxTop + GROUP_LABEL_INSET
    const plotTop =
        groupLabelY + groupLabelHeight + GROUP_LABEL_GAP + clearanceAboveBars
    const bottomMargin = PLOT_MARGIN_BOTTOM

    const boxHeight = height - plotTop - bottomMargin
    if (boxHeight <= 0) return null

    const box = {
        x: axisLabelWidth,
        y: plotTop,
        width: plotWidth,
        height: boxHeight,
    }
    const layout = layOutWaterfall(waterfall, box)
    const groupBoxBottom = box.y + box.height
    const groupedStepKeys = new Set(
        layout.groups.flatMap(({ group }) => group.stageKeys)
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
                className="food-supply-chain-waterfall"
                width={width}
                height={height}
                viewBox={`0 0 ${width} ${height}`}
            >
                {layout.groups.map(({ group, box: groupBox }) => (
                    <GroupBox
                        key={group.key}
                        box={groupBox}
                        top={groupBoxTop}
                        bottom={groupBoxBottom}
                        labelTextWrap={groupLabelTextWraps.get(group.key)}
                        labelY={groupLabelY}
                        fill={COLORS.groupBox}
                        labelColor={COLORS.groupLabel}
                    />
                ))}
                <GroupBox
                    box={layout.totalBox}
                    top={groupBoxTop}
                    bottom={groupBoxBottom}
                    labelTextWrap={totalLabelTextWrap}
                    labelY={groupLabelY}
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
                    <Connector
                        key={index}
                        connector={connector}
                        isDimmed={hover !== undefined}
                    />
                ))}
                {layout.steps.map((step, index) =>
                    step.step.delta === 0 ? null : (
                        <StepMarks
                            key={step.step.key}
                            step={step}
                            valueLabelText={valueLabelTexts[index]}
                            isTotal={false}
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
                    )
                )}
                <StepMarks
                    step={layout.total}
                    valueLabelText={totalValueLabelText}
                    isTotal
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
                        y={step.slot.y}
                        width={step.slot.width}
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

/** The pixels one step's column gets at this width */
export function measureVerticalSlotWidth(
    waterfall: Waterfall,
    width: number
): number {
    const plotWidth =
        width -
        measureAxisLabelWidth(buildTickLabels(waterfall)) -
        PLOT_MARGIN_RIGHT
    return measureSlotWidth(plotWidth, waterfall.steps.length)
}

function buildTickLabels(waterfall: Waterfall): Map<number, string> {
    const span = waterfall.domain[1] - waterfall.domain[0]
    return new Map(
        chooseTickValues(waterfall.domain).map((value) => [
            value,
            formatMeasureValue(value, { span, unit: waterfall.shortUnit }),
        ])
    )
}

function measureAxisLabelWidth(tickLabels: Map<number, string>): number {
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
    isDimmed,
    captionTextWrap,
    backgroundColor,
}: {
    step: PlacedStep
    valueLabelText: string
    isTotal: boolean
    isDimmed: boolean
    /** Absent for the total, whose box carries its label */
    captionTextWrap?: TextWrap
    /** What the labels sit on, which their halo takes the colour of */
    backgroundColor: string
}): React.ReactElement {
    const barColor = isTotal
        ? COLORS.total
        : isAddition(step.step)
          ? COLORS.add
          : COLORS.subtract

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
                    {!isTotal && <BarArrow step={step} bar={step.bar} />}
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

/** A line from one bar to the next, shifted half its width onto the left bar's side of their shared edge */
function Connector({
    connector,
    isDimmed,
}: {
    connector: PlacedConnector
    isDimmed: boolean
}): React.ReactElement {
    const { leftStep, line } = connector
    const isAddition = leftStep.delta > 0
    // An addition's bar lies below its far end on screen, a subtraction's above
    const y = line.y1 + ((isAddition ? 1 : -1) * CONNECTOR_WIDTH) / 2
    return (
        <line
            className={cx(
                "food-supply-chain-waterfall__connector",
                isDimmed && "food-supply-chain-waterfall__connector--dimmed"
            )}
            x1={line.x1}
            y1={y}
            x2={line.x2}
            y2={y}
            stroke={isAddition ? COLORS.add : COLORS.subtract}
            strokeWidth={CONNECTOR_WIDTH}
        />
    )
}

function GroupBox({
    box,
    top,
    bottom,
    labelTextWrap,
    labelY,
    fill,
    labelColor,
}: {
    box: PlacedRect
    top: number
    bottom: number
    labelTextWrap: TextWrap | undefined
    labelY: number
    fill: string
    labelColor: string
}): React.ReactElement | null {
    if (!labelTextWrap) return null

    return (
        <g className="food-supply-chain-waterfall__group">
            <rect
                className="food-supply-chain-waterfall__group-box"
                x={box.x}
                y={top}
                width={box.width}
                height={bottom - top}
                rx={GROUP_BOX_CORNER_RADIUS}
                fill={fill}
            />
            <TextWrapSvg
                className="food-supply-chain-waterfall__group-label"
                textWrap={labelTextWrap}
                x={box.x + GROUP_LABEL_INSET}
                y={labelY}
                fill={labelColor}
            />
        </g>
    )
}

function getValueLabelFontSize(isTotal: boolean): number {
    return isTotal ? TOTAL_LABEL_FONT_SIZE : VALUE_LABEL_FONT_SIZE
}

/** Distance from the top of a step's bar to the bottom of its caption, with the value label in between */
function measureCaptionOffset(): number {
    return VALUE_LABEL_GAP + VALUE_LABEL_FONT_SIZE + CAPTION_VALUE_LABEL_GAP
}

/** The top of a step's bar, or where it would start for a step of zero */
function measureBarTop(step: PlacedStep): number {
    return step.bar?.y ?? step.valueAnchor.y
}

function placeCaptionTop(step: PlacedStep, captionHeight: number): number {
    return measureBarTop(step) - measureCaptionOffset() - captionHeight
}

/** An arrow through the bar, pointing the way the balance moves; drawn only if the bar has room for it */
function BarArrow({
    step,
    bar,
}: {
    step: PlacedStep
    bar: PlacedBar
}): React.ReactElement | null {
    if (bar.height < ARROW_MIN_LENGTH + 2 * ARROW_INSET) return null

    // +1 walks down the screen from the far end, -1 walks up
    const direction = step.step.delta > 0 ? 1 : -1
    const { x, y: farEndY } = step.valueAnchor
    return (
        <BezierArrow
            className="food-supply-chain-waterfall__arrow"
            start={{ x, y: farEndY + direction * (bar.height - ARROW_INSET) }}
            end={{ x, y: farEndY + direction * ARROW_INSET }}
            width={ARROW_WIDTH}
            color={COLORS.arrow}
            opacity={ARROW_OPACITY}
        />
    )
}

function buildGroupLabelTextWrap(text: string, maxWidth: number): TextWrap {
    return new TextWrap({
        text,
        maxWidth,
        fontSize: GROUP_LABEL_FONT_SIZE,
        fontWeight: GROUP_LABEL_FONT_WEIGHT,
    })
}

function buildCaptionTextWrap(text: string, slotWidth: number): TextWrap {
    return buildTruncatedTextWrap({
        text,
        maxWidth: captionLength(slotWidth),
        maxLines: MAX_CAPTION_LINES,
        fontSize: CAPTION_FONT_SIZE,
        fontWeight: CAPTION_FONT_WEIGHT,
    })
}
