import React from "react"
import { makeFigmaId, dyFromAlign } from "@ourworldindata/utils"
import { Halo, TextWrapSvg } from "@ourworldindata/components"
import { DumbbellConnectorStyle, VerticalAlign } from "@ourworldindata/types"
import { FontSettings } from "../core/GrapherConstants"
import { SeriesLabel } from "../seriesLabel/SeriesLabel"
import { TimeRangeDumbbell, TwoColumnDumbbell } from "./Dumbbell"
import {
    LabelledDumbbellHead,
    RenderDumbbellSeries,
    DumbbellMode,
    DUMBBELL_STYLE,
    PlacedDumbbellHead,
} from "./DumbbellChartConstants"
import { toLeftRight } from "./DumbbellChartHelpers"
import { GRID_LINE_DASH_PATTERN, TICK_COLOR } from "../axis/AxisViews.js"
import { darkenColorForText } from "../color/ColorUtils.js"
import { GRAPHER_DARK_TEXT } from "../color/ColorConstants.js"

export function DumbbellChartRow({
    series,
    mode,
    connectorStyle,
    y,
    range,
    valueLabelStyle,
    onInfoTooltipShow,
}: {
    series: RenderDumbbellSeries
    mode: DumbbellMode
    connectorStyle: DumbbellConnectorStyle
    y: number
    range: [number, number]
    valueLabelStyle: FontSettings
    onInfoTooltipShow?: () => void
}): React.ReactElement {
    const style = DUMBBELL_STYLE[series.emphasis]
    const { left: leftHead, right: rightHead } = toLeftRight(
        series.start,
        series.end
    )

    return (
        <g
            id={makeFigmaId(series.seriesName)}
            transform={`translate(0, ${y})`}
            opacity={style.opacity}
            style={{ pointerEvents: "none" }}
        >
            {/* Gray background line spanning the full chart width */}
            <line
                id={makeFigmaId("background-line")}
                x1={range[0]}
                x2={range[1]}
                stroke={TICK_COLOR}
                strokeDasharray={GRID_LINE_DASH_PATTERN}
            />

            {/* Entity label */}
            {series.label && (
                <SeriesLabel
                    state={series.label}
                    x={series.labelPosition.x}
                    y={series.labelPosition.yOffset}
                    color={{ name: style.labelColor }}
                    onInfoTooltipShow={onInfoTooltipShow}
                />
            )}

            {/* Entity annotation */}
            {series.annotationTextWrap &&
                series.annotationPosition !== undefined && (
                    <TextWrapSvg
                        textWrap={series.annotationTextWrap}
                        x={series.annotationPosition.x}
                        y={series.annotationPosition.yOffset}
                        fill={GRAPHER_DARK_TEXT}
                        textAnchor="end"
                    />
                )}

            {/* Dumbbell */}
            {mode === DumbbellMode.TimeRange ? (
                <TimeRangeDumbbell series={series} />
            ) : (
                <TwoColumnDumbbell
                    series={series}
                    connectorStyle={connectorStyle}
                />
            )}

            {/* Left value label */}
            {hasLabel(leftHead) && (
                <DumbbellValueLabel
                    side="left"
                    head={leftHead}
                    style={valueLabelStyle}
                />
            )}

            {/* Right value label */}
            {hasLabel(rightHead) && (
                <DumbbellValueLabel
                    side="right"
                    head={rightHead}
                    style={valueLabelStyle}
                />
            )}
        </g>
    )
}

function DumbbellValueLabel({
    side,
    head,
    style,
}: {
    side: "left" | "right"
    head: LabelledDumbbellHead
    style: FontSettings
}): React.ReactElement {
    const x =
        side === "left"
            ? head.x - head.label.padding
            : head.x + head.label.padding

    return (
        <Halo
            id={makeFigmaId(`${head.label.text}__halo`)}
            fontSize={style.fontSize}
        >
            <text
                x={x}
                fill={darkenColorForText(head.color)}
                dy={dyFromAlign(VerticalAlign.middle)}
                textAnchor={side === "left" ? "end" : "start"}
                fontSize={style.fontSize}
                fontWeight={style.fontWeight}
            >
                {head.label.text}
            </text>
        </Halo>
    )
}

export function hasLabel(
    head: PlacedDumbbellHead
): head is LabelledDumbbellHead {
    return head.label !== undefined
}
