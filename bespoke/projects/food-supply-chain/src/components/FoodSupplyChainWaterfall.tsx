import {
    shortenWithEllipsis,
    TextWrap,
} from "@ourworldindata/components/src/TextWrap/TextWrap.js"
import { TextWrapSvg } from "@ourworldindata/components/src/TextWrap/TextWrapComponents.js"

import {
    AXIS_LABEL_WIDTH,
    CAPTION_FONT_SIZE,
    CAPTION_GAP,
    MAX_CAPTION_LINES,
    COLORS,
    PLOT_MARGIN_RIGHT,
    PLOT_MARGIN_TOP,
    TICK_LABEL_FONT_SIZE,
    VALUE_LABEL_FONT_SIZE,
    VALUE_LABEL_GAP,
} from "../core/constants.js"
import { formatMeasureValue } from "../core/format.js"
import { Waterfall } from "../core/waterfall.js"
import { layOutWaterfall, PlacedStep } from "../core/waterfallLayout.js"

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

    const bottomMargin =
        Math.max(
            ...captionTextWraps.map((wrap) => wrap.height),
            totalCaptionTextWrap.height
        ) + CAPTION_GAP

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

    return (
        <svg
            className="food-supply-chain-waterfall"
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
        >
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
                    isTotal={false}
                    captionTextWrap={captionTextWraps[index]}
                    captionY={captionY}
                />
            ))}
            <StepMarks
                step={layout.total}
                span={span}
                isTotal
                captionTextWrap={totalCaptionTextWrap}
                captionY={captionY}
            />
        </svg>
    )
}

function StepMarks({
    step,
    span,
    isTotal,
    captionTextWrap,
    captionY,
}: {
    step: PlacedStep
    span: number
    isTotal: boolean
    captionTextWrap: TextWrap
    captionY: number
}): React.ReactElement {
    const { delta } = step.step
    const barColor = isTotal
        ? COLORS.total
        : delta > 0
          ? COLORS.add
          : COLORS.subtract

    const valueLabelDy =
        delta >= 0 ? -VALUE_LABEL_GAP : VALUE_LABEL_FONT_SIZE + VALUE_LABEL_GAP
    const valueLabelText = isTotal
        ? formatMeasureValue(delta, { span })
        : formatMeasureValue(delta, { span, showPlus: true })

    return (
        <g>
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
            <text
                className="food-supply-chain-waterfall__value-label"
                x={step.valueAnchor.x}
                y={step.valueAnchor.y}
                dy={valueLabelDy}
                textAnchor="middle"
                fontSize={VALUE_LABEL_FONT_SIZE}
                fill={COLORS.valueLabel}
            >
                {valueLabelText}
            </text>
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
