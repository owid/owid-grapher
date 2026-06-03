import React from "react"
import { makeFigmaId, dyFromAlign } from "@ourworldindata/utils"
import { Halo, TextWrapSvg } from "@ourworldindata/components"
import { VerticalAlign } from "@ourworldindata/types"
import { FontSettings } from "../core/GrapherConstants"
import { SeriesLabel } from "../seriesLabel/SeriesLabel"
import { GRAPHER_DARK_TEXT } from "../color/ColorConstants"
import { Dumbbell } from "./Dumbbell"
import {
    PlacedDumbbellHead,
    RenderDumbbellSeries,
    DUMBBELL_STYLE,
} from "./DumbbellChartConstants"
import { GRID_LINE_DASH_PATTERN, TICK_COLOR } from "../axis/AxisViews.js"

export function DumbbellChartRow({
    series,
    y,
    range,
    valueLabelStyle,
}: {
    series: RenderDumbbellSeries
    y: number
    range: [number, number]
    valueLabelStyle: FontSettings
}): React.ReactElement {
    const style = DUMBBELL_STYLE[series.emphasis]

    return (
        <g
            id={makeFigmaId(series.seriesName)}
            transform={`translate(0, ${y})`}
            opacity={style.opacity}
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
                />
            )}

            {/* Entity annotation */}
            {series.annotationTextWrap &&
                series.annotationPosition !== undefined && (
                    <TextWrapSvg
                        textWrap={series.annotationTextWrap}
                        x={series.annotationPosition.x}
                        y={series.annotationPosition.yOffset}
                        fill="#333"
                        textAnchor="end"
                    />
                )}

            {/* Dumbbell */}
            <Dumbbell series={series} />

            {/* Left value label */}
            <DumbbellValueLabel
                side="left"
                head={series.left}
                style={valueLabelStyle}
            />

            {/* Right value label */}
            <DumbbellValueLabel
                side="right"
                head={series.right}
                style={valueLabelStyle}
            />
        </g>
    )
}

function DumbbellValueLabel({
    side,
    head,
    style,
}: {
    side: "left" | "right"
    head: PlacedDumbbellHead
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
                fill={GRAPHER_DARK_TEXT}
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
