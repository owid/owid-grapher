import { useMemo } from "react"

import { TextWrap } from "@ourworldindata/components/src/TextWrap/TextWrap.js"
import { TextWrapSvg } from "@ourworldindata/components/src/TextWrap/TextWrapComponents.js"
import { Halo } from "@ourworldindata/components/src/Halo/Halo.js"
import { Box } from "@ourworldindata/types"

import {
    COLORS,
    GROUP_BOX_CORNER_RADIUS,
    GROUP_HEADER_GAP,
    LABEL_HALO_WIDTH,
    TICK_LABEL_FONT_SIZE,
    TICK_LABEL_GAP,
    TOTAL_LABEL_FONT_SIZE,
    TOTAL_LABEL_FONT_WEIGHT,
    VALUE_LABEL_BASELINE_OFFSET,
    VALUE_LABEL_FONT_SIZE,
    VALUE_LABEL_FONT_WEIGHT,
    VALUE_LABEL_SIDE_GAP,
} from "../core/constants.js"
import { useStepHover } from "../core/useStepHover.js"
import { chooseStepColor, Waterfall } from "../core/waterfall.js"
import { PlacedStep } from "../core/waterfallLayout.js"
import { planHorizontalWaterfall } from "../core/horizontalWaterfallPlan.js"
import { FoodSupplyChainTooltip } from "./FoodSupplyChainTooltip.js"
import {
    FoodSupplyChainConnectors,
    FoodSupplyChainZeroLine,
} from "./FoodSupplyChainConnectors.js"
import { FoodSupplyChainBar } from "./FoodSupplyChainBar.js"
import { FoodSupplyChainHitArea } from "./FoodSupplyChainHitArea.js"

export interface FoodSupplyChainWaterfallHorizontalProps {
    waterfall: Waterfall
    width: number
}

export function FoodSupplyChainWaterfallHorizontal({
    waterfall,
    width,
}: FoodSupplyChainWaterfallHorizontalProps): React.ReactElement | null {
    const {
        svgRef,
        containerRef,
        hover,
        isPinned,
        isStepDimmed,
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
        shownTickLabelsByValue,
        stepValueLabelTexts,
        totalValueLabelText,
        captionTextWraps,
        totalCaptionTextWrap,
        captionRight,
        groupHeaderTextWraps,
        height,
        layout,
        stepBackgroundColors,
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
                        {shownTickLabelsByValue.has(tick.value) && (
                            <text
                                className="food-supply-chain-waterfall__tick-label"
                                x={tick.gridline.x1}
                                y={tick.gridline.y1}
                                dy={-TICK_LABEL_GAP}
                                textAnchor="middle"
                                fontSize={TICK_LABEL_FONT_SIZE}
                                fill={COLORS.tickLabel}
                            >
                                {shownTickLabelsByValue.get(tick.value)}
                            </text>
                        )}
                    </g>
                ))}
                <FoodSupplyChainZeroLine line={layout.zeroLine} />
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
                        isDimmed={isStepDimmed(step.step.key)}
                        captionRight={captionRight}
                        backgroundColor={stepBackgroundColors[index]}
                    />
                ))}
                <RowMarks
                    step={layout.total}
                    captionTextWrap={totalCaptionTextWrap}
                    valueLabelText={totalValueLabelText}
                    isTotal
                    showArrow={false}
                    isDimmed={isStepDimmed(waterfall.total.key)}
                    captionRight={captionRight}
                    backgroundColor={COLORS.totalBox}
                />
                {[...layout.steps, layout.total].map((step) => (
                    <FoodSupplyChainHitArea
                        key={step.step.key}
                        stepKey={step.step.key}
                        box={{
                            x: 0,
                            y: step.slot.y,
                            width,
                            height: step.slot.height,
                        }}
                        onStepMouseEnter={onStepMouseEnter}
                        onStepMouseMove={onStepMouseMove}
                        onStepMouseLeave={onStepMouseLeave}
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
                <FoodSupplyChainBar
                    bar={step.bar}
                    arrow={step.arrow}
                    color={barColor}
                    showArrow={showArrow}
                />
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
