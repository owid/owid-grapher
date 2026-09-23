import { useCallback, useRef, useState } from "react"

import {
    shortenWithEllipsis,
    TextWrap,
} from "@ourworldindata/components/src/TextWrap/TextWrap.js"
import { TextWrapSvg } from "@ourworldindata/components/src/TextWrap/TextWrapComponents.js"
import {
    Bounds,
    getRelativeMouse,
    isTouchDevice,
    Point,
} from "@ourworldindata/utils"
import { GrapherTooltipAnchor } from "@ourworldindata/types"

import { usePinnedTooltip } from "../../../../hooks/usePinnedTooltip.js"
import {
    ARROW_GAP,
    ARROW_HALF_WIDTH,
    ARROW_HEIGHT,
    AXIS_LABEL_WIDTH,
    CAPTION_FONT_SIZE,
    CAPTION_GAP,
    GROUP_BOX_CORNER_RADIUS,
    GROUP_BOX_PADDING,
    GROUP_LABEL_FONT_SIZE,
    GROUP_LABEL_FONT_WEIGHT,
    GROUP_LABEL_GAP,
    MAX_CAPTION_LINES,
    COLORS,
    PLOT_MARGIN_RIGHT,
    PLOT_MARGIN_TOP,
    TICK_LABEL_FONT_SIZE,
    TOTAL_LABEL_FONT_SIZE,
    VALUE_LABEL_FONT_SIZE,
    VALUE_LABEL_FONT_WEIGHT,
    TOTAL_LABEL_GAP,
    VALUE_LABEL_INSET,
} from "../core/constants.js"
import { formatMeasureValue } from "../core/format.js"
import { STAGE_GROUPS } from "../core/stageGroups.js"
import { StageKey } from "../core/types.js"
import { Waterfall } from "../core/waterfall.js"
import {
    groupBoxLength,
    layOutWaterfall,
    PlacedBar,
    PlacedRect,
    PlacedStep,
} from "../core/waterfallLayout.js"
import { FoodSupplyChainTooltip } from "./FoodSupplyChainTooltip.js"

export interface FoodSupplyChainWaterfallProps {
    waterfall: Waterfall
    width: number
    height: number
}

/** The hovered or touch-pinned column, at the mouse position that triggered it */
interface Hover {
    stepKey: StageKey
    position: Point
}

export function FoodSupplyChainWaterfall({
    waterfall,
    width,
    height,
}: FoodSupplyChainWaterfallProps): React.ReactElement | null {
    const svgRef = useRef<SVGSVGElement>(null)
    const [hover, setHover] = useState<Hover | undefined>(undefined)

    const dismissHover = useCallback(() => setHover(undefined), [])
    const { ref: containerRef, isPinned } = usePinnedTooltip<HTMLDivElement>(
        hover !== undefined,
        dismissHover
    )

    const onStepMouseEnter = useCallback(
        (stepKey: StageKey, event: React.MouseEvent) => {
            if (!svgRef.current) return
            const position = getRelativeMouse(svgRef.current, event.nativeEvent)
            setHover({ stepKey, position })
        },
        []
    )
    const onStepMouseMove = useCallback((event: React.MouseEvent) => {
        if (!svgRef.current) return
        const position = getRelativeMouse(svgRef.current, event.nativeEvent)
        setHover((prev) => (prev ? { ...prev, position } : prev))
    }, [])
    const onStepMouseLeave = useCallback(() => {
        // usePinnedTooltip owns dismissal on touch
        if (isTouchDevice()) return
        setHover(undefined)
    }, [])

    const plotWidth = width - AXIS_LABEL_WIDTH - PLOT_MARGIN_RIGHT
    if (plotWidth <= 0) return null

    const slotWidth = plotWidth / (waterfall.steps.length + 1)
    const captionTextWraps = waterfall.steps.map((step) =>
        buildCaptionTextWrap(step.name, slotWidth)
    )
    const totalCaptionTextWrap = buildCaptionTextWrap(
        waterfall.total.name,
        slotWidth
    )

    const groupLabelTextWraps = new Map(
        STAGE_GROUPS.map((group) => [
            group.key,
            buildGroupLabelTextWrap(
                group.label.toUpperCase(),
                groupBoxLength(slotWidth, group.stageKeys.length) -
                    2 * GROUP_BOX_PADDING
            ),
        ])
    )

    const captionHeight = Math.max(
        ...captionTextWraps.map((wrap) => wrap.height),
        totalCaptionTextWrap.height
    )
    const groupLabelHeight = Math.max(
        ...[...groupLabelTextWraps.values()].map((wrap) => wrap.height)
    )
    const bottomMargin =
        CAPTION_GAP +
        captionHeight +
        GROUP_LABEL_GAP +
        groupLabelHeight +
        GROUP_BOX_PADDING

    const boxHeight = height - PLOT_MARGIN_TOP - bottomMargin
    if (boxHeight <= 0) return null

    const box = {
        x: AXIS_LABEL_WIDTH,
        y: PLOT_MARGIN_TOP,
        width: plotWidth,
        height: boxHeight,
    }
    const layout = layOutWaterfall(waterfall, box)
    const span = waterfall.domain[1] - waterfall.domain[0]
    const captionY = box.y + box.height + CAPTION_GAP
    const groupLabelY = captionY + captionHeight + GROUP_LABEL_GAP
    const groupBoxTop = box.y - ARROW_GAP - ARROW_HEIGHT - GROUP_BOX_PADDING
    const groupBoxBottom = groupLabelY + groupLabelHeight + GROUP_BOX_PADDING
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
                    />
                ))}
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
                            dx={-8}
                            textAnchor="end"
                            dominantBaseline="middle"
                            fontSize={TICK_LABEL_FONT_SIZE}
                            fill={COLORS.tickLabel}
                        >
                            {formatMeasureValue(tick.value, { span })}
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
                    <line
                        key={index}
                        className="food-supply-chain-waterfall__connector"
                        x1={connector.x1}
                        y1={connector.y1}
                        x2={connector.x2}
                        y2={connector.y2}
                        stroke={COLORS.connector}
                    />
                ))}
                {layout.steps.map((step, index) => (
                    <StepMarks
                        key={step.step.key}
                        step={step}
                        span={span}
                        unit={waterfall.stepLabelUnit}
                        isTotal={false}
                        isDimmed={
                            hover !== undefined &&
                            hover.stepKey !== step.step.key
                        }
                        captionTextWrap={captionTextWraps[index]}
                        captionY={captionY}
                    />
                ))}
                <StepMarks
                    step={layout.total}
                    span={span}
                    unit={waterfall.shortUnit}
                    isTotal
                    isDimmed={
                        hover !== undefined &&
                        hover.stepKey !== waterfall.total.key
                    }
                    captionTextWrap={totalCaptionTextWrap}
                    captionY={captionY}
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

function StepMarks({
    step,
    span,
    unit,
    isTotal,
    isDimmed,
    captionTextWrap,
    captionY,
}: {
    step: PlacedStep
    span: number
    unit: string | undefined
    isTotal: boolean
    isDimmed: boolean
    captionTextWrap: TextWrap
    captionY: number
}): React.ReactElement {
    const { delta } = step.step
    const barColor = isTotal
        ? COLORS.total
        : delta > 0
          ? COLORS.add
          : COLORS.subtract

    const valueLabelText = formatMeasureValue(delta, {
        span,
        unit,
        showPlus: true,
    })
    return (
        <g
            className={
                isDimmed
                    ? "food-supply-chain-waterfall__step--dimmed"
                    : undefined
            }
        >
            {step.bar && (
                <rect
                    className="food-supply-chain-waterfall__bar"
                    x={step.bar.x}
                    y={step.bar.y}
                    width={step.bar.width}
                    height={step.bar.height}
                    fill={barColor}
                />
            )}
            {!isTotal && step.bar && (
                <path
                    className="food-supply-chain-waterfall__arrow"
                    d={buildArrowPath(step, step.bar)}
                    fill={barColor}
                />
            )}
            {isTotal ? (
                <text
                    className="food-supply-chain-waterfall__value-label"
                    x={step.valueAnchor.x}
                    y={step.valueAnchor.y}
                    dy={
                        delta >= 0
                            ? -TOTAL_LABEL_GAP
                            : TOTAL_LABEL_FONT_SIZE + TOTAL_LABEL_GAP
                    }
                    textAnchor="middle"
                    fontSize={TOTAL_LABEL_FONT_SIZE}
                    fontWeight={VALUE_LABEL_FONT_WEIGHT}
                    fill={barColor}
                >
                    {formatMeasureValue(delta, { span, unit })}
                </text>
            ) : (
                step.bar &&
                doesLabelFitInsideBar(valueLabelText, step.bar) && (
                    <text
                        className="food-supply-chain-waterfall__value-label"
                        x={step.bar.x + step.bar.width / 2}
                        y={
                            delta > 0
                                ? step.bar.y +
                                  VALUE_LABEL_INSET +
                                  VALUE_LABEL_FONT_SIZE / 2
                                : step.bar.y +
                                  step.bar.height -
                                  VALUE_LABEL_INSET -
                                  VALUE_LABEL_FONT_SIZE / 2
                        }
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize={VALUE_LABEL_FONT_SIZE}
                        fontWeight={VALUE_LABEL_FONT_WEIGHT}
                        fill={COLORS.valueLabelInsideBar}
                    >
                        {valueLabelText}
                    </text>
                )
            )}
            <TextWrapSvg
                className="food-supply-chain-waterfall__caption"
                textWrap={captionTextWrap}
                x={step.captionAnchor.x}
                y={captionY}
                textAnchor="middle"
                fill={COLORS.caption}
            />
        </g>
    )
}

function GroupBox({
    box,
    top,
    bottom,
    labelTextWrap,
    labelY,
}: {
    box: PlacedRect
    top: number
    bottom: number
    labelTextWrap: TextWrap | undefined
    labelY: number
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
                fill={COLORS.groupBox}
            />
            <rect
                className="food-supply-chain-waterfall__group-label-box"
                x={box.x}
                y={labelY - GROUP_BOX_PADDING}
                width={box.width}
                height={bottom - labelY + GROUP_BOX_PADDING}
                rx={GROUP_BOX_CORNER_RADIUS}
                fill={COLORS.groupLabelBox}
            />
            <TextWrapSvg
                className="food-supply-chain-waterfall__group-label"
                textWrap={labelTextWrap}
                x={box.x + box.width / 2}
                y={labelY}
                textAnchor="middle"
                fill={COLORS.groupLabel}
            />
        </g>
    )
}

function doesLabelFitInsideBar(text: string, bar: PlacedBar): boolean {
    const textWidth = Bounds.forText(text, {
        fontSize: VALUE_LABEL_FONT_SIZE,
        fontWeight: VALUE_LABEL_FONT_WEIGHT,
    }).width
    return (
        bar.width >= textWidth + 2 * VALUE_LABEL_INSET &&
        bar.height >= VALUE_LABEL_FONT_SIZE + 2 * VALUE_LABEL_INSET
    )
}

/** A triangle just past the bar's far end, pointing the way the balance moves */
function buildArrowPath(step: PlacedStep, bar: PlacedBar): string {
    const { x, y } = step.valueAnchor
    const direction = step.step.delta > 0 ? -1 : 1
    const halfWidth = Math.min(ARROW_HALF_WIDTH, bar.width / 2)
    const baseY = y + direction * ARROW_GAP
    const tipY = baseY + direction * ARROW_HEIGHT
    return `M ${x},${tipY} L ${x - halfWidth},${baseY} L ${x + halfWidth},${baseY} Z`
}

function buildGroupLabelTextWrap(text: string, maxWidth: number): TextWrap {
    return new TextWrap({
        text,
        maxWidth,
        fontSize: GROUP_LABEL_FONT_SIZE,
        fontWeight: GROUP_LABEL_FONT_WEIGHT,
    })
}

/** A caption's TextWrap, truncated to at most MAX_CAPTION_LINES lines */
function buildCaptionTextWrap(text: string, slotWidth: number): TextWrap {
    const maxWidth = slotWidth - 4
    const wrap = new TextWrap({ text, maxWidth, fontSize: CAPTION_FONT_SIZE })
    if (wrap.lines.length <= MAX_CAPTION_LINES) return wrap

    const kept = wrap.lines.slice(0, MAX_CAPTION_LINES).map((line) => line.text)
    kept[kept.length - 1] = shortenWithEllipsis(
        kept[kept.length - 1],
        maxWidth,
        {
            fontSize: CAPTION_FONT_SIZE,
        }
    )
    return new TextWrap({
        text: kept.join("\n"),
        maxWidth,
        fontSize: CAPTION_FONT_SIZE,
    })
}
