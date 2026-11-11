import { useMemo } from "react"

import { TextWrap } from "@ourworldindata/components/src/TextWrap/TextWrap.js"
import { TextWrapSvg } from "@ourworldindata/components/src/TextWrap/TextWrapComponents.js"
import { Halo } from "@ourworldindata/components/src/Halo/Halo.js"
import { Box } from "@ourworldindata/types"

import {
    GROUP_BOX_CORNER_RADIUS,
    GROUP_LABEL_INSET,
    LABEL_HALO_WIDTH,
    COLORS,
    TICK_LABEL_FONT_SIZE,
    TICK_LABEL_GAP,
    TOTAL_LABEL_FONT_SIZE,
    TOTAL_LABEL_FONT_WEIGHT,
    VALUE_LABEL_FONT_SIZE,
    VALUE_LABEL_FONT_WEIGHT,
    VALUE_LABEL_GAP,
} from "../core/constants.js"
import { useStepHover } from "../core/useStepHover.js"
import { chooseStepColor, Waterfall } from "../core/waterfall.js"
import { measureCaptionLength, PlacedStep } from "../core/waterfallLayout.js"
import {
    measureBarTop,
    placeCaptionTop,
    planVerticalWaterfall,
} from "../core/verticalWaterfallPlan.js"
import { FoodSupplyChainTooltip } from "./FoodSupplyChainTooltip.js"
import {
    FoodSupplyChainConnectors,
    FoodSupplyChainZeroLine,
} from "./FoodSupplyChainConnectors.js"
import { FoodSupplyChainBar } from "./FoodSupplyChainBar.js"
import { FoodSupplyChainHitArea } from "./FoodSupplyChainHitArea.js"

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
        isStepDimmed,
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
                <FoodSupplyChainZeroLine line={layout.zeroLine} />
                <FoodSupplyChainConnectors
                    layout={layout}
                    isDimmed={hover !== undefined}
                />
                {layout.steps.map((step, index) => (
                    <StepMarks
                        key={step.step.key}
                        step={step}
                        valueLabelText={valueLabelTexts[index]}
                        isTotal={false}
                        showArrow={index > 0}
                        isDimmed={isStepDimmed(step.step.key)}
                        captionTextWrap={captionTextWraps[index]}
                        backgroundColor={stepBackgroundColors[index]}
                    />
                ))}
                <StepMarks
                    step={layout.total}
                    valueLabelText={totalValueLabelText}
                    isTotal
                    showArrow={false}
                    isDimmed={isStepDimmed(waterfall.total.key)}
                    backgroundColor={COLORS.totalBox}
                />
                {[...layout.steps, layout.total].map((step) => (
                    <FoodSupplyChainHitArea
                        key={step.step.key}
                        stepKey={step.step.key}
                        box={{
                            x: step.slot.x,
                            y: columnTop,
                            width: step.slot.width,
                            height: step.slot.y + step.slot.height - columnTop,
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
    captionTextWrap?: TextWrap
    backgroundColor: string
}): React.ReactElement {
    const barColor = chooseStepColor(step.step, isTotal)

    const labelX =
        step.slot.x + step.slot.width - measureCaptionLength(step.slot.width)

    return (
        <g
            className={
                isDimmed
                    ? "food-supply-chain-waterfall__step--dimmed"
                    : undefined
            }
        >
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
                <text
                    className="food-supply-chain-waterfall__value-label"
                    x={isTotal ? step.valueAnchor.x : labelX}
                    y={measureBarTop(step) - VALUE_LABEL_GAP}
                    textAnchor={isTotal ? "middle" : "start"}
                    fontSize={
                        isTotal ? TOTAL_LABEL_FONT_SIZE : VALUE_LABEL_FONT_SIZE
                    }
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
    box: Box
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
