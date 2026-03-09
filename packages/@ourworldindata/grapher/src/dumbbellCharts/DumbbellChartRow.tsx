import React from "react"
import { makeFigmaId, dyFromAlign } from "@ourworldindata/utils"
import { VerticalAlign } from "@ourworldindata/types"
import { FontSettings } from "../core/GrapherConstants"
import { SeriesLabel } from "../seriesLabel/SeriesLabel"
import { GRAPHER_DARK_TEXT } from "../color/ColorConstants"
import { Dumbbell } from "./Dumbbell"
import {
    RenderDumbbellChartSeries,
    RenderDumbbellDataSeries,
    DUMBBELL_STYLE,
} from "./DumbbellChartConstants"

/** The gap between the entity label and the dumbbell */
const GAP__ENTITY_LABEL__DUMBBELL = 5

export function DumbbellChartRow({
    series,
    translateY,
    chartAreaLeft,
    chartAreaRight,
    dotRadius,
    valueLabelStyle,
    formatValue,
}: {
    series: RenderDumbbellChartSeries
    translateY: number
    chartAreaLeft: number
    chartAreaRight: number
    dotRadius: number
    valueLabelStyle: FontSettings
    formatValue: (value: number) => string
}): React.ReactElement {
    const style = DUMBBELL_STYLE[series.emphasis]

    // Rebase y-coordinates relative to barY (since the group is translated)
    const labelY = series.entityLabelY - series.barY
    const annotationY =
        series.annotationY !== undefined
            ? series.annotationY - series.barY
            : undefined

    return (
        <g
            id={makeFigmaId(series.seriesName)}
            transform={`translate(0, ${translateY})`}
        >
            {/* Entity label */}
            {series.label && (
                <SeriesLabel
                    state={series.label}
                    x={series.entityLabelX}
                    y={labelY}
                    opacity={style.labelOpacity}
                />
            )}

            {/* Entity annotation */}
            {series.annotationTextWrap && annotationY !== undefined && (
                <g>
                    {series.annotationTextWrap.renderSVG(
                        series.entityLabelX,
                        annotationY,
                        {
                            textProps: {
                                fill: "#333",
                                textAnchor: "end",
                                opacity: style.labelOpacity,
                            },
                        }
                    )}
                </g>
            )}

            {/* Data row: dumbbell + value labels */}
            {series.type === "data" && (
                <DataRowContent
                    series={series}
                    chartAreaLeft={chartAreaLeft}
                    chartAreaRight={chartAreaRight}
                    dotRadius={dotRadius}
                    valueLabelStyle={valueLabelStyle}
                    formatValue={formatValue}
                />
            )}

            {/* No-data row: gray line + "No data" text */}
            {series.type === "no-data" && (
                <>
                    <line
                        x1={chartAreaLeft}
                        y1={0}
                        x2={chartAreaRight}
                        y2={0}
                        stroke="#eee"
                        strokeWidth={1}
                    />
                    <text
                        x={(chartAreaLeft + chartAreaRight) / 2}
                        y={0}
                        dy={dyFromAlign(VerticalAlign.middle)}
                        textAnchor="middle"
                        fontSize={valueLabelStyle.fontSize}
                        fontWeight={valueLabelStyle.fontWeight}
                        fill="#999"
                        fontStyle="italic"
                    >
                        No data
                    </text>
                </>
            )}
        </g>
    )
}

function DataRowContent({
    series,
    chartAreaLeft,
    chartAreaRight,
    dotRadius,
    valueLabelStyle,
    formatValue,
}: {
    series: RenderDumbbellDataSeries
    chartAreaLeft: number
    chartAreaRight: number
    dotRadius: number
    valueLabelStyle: FontSettings
    formatValue: (value: number) => string
}): React.ReactElement {
    const style = DUMBBELL_STYLE[series.emphasis]
    const minX = Math.min(series.startX, series.endX)
    const maxX = Math.max(series.startX, series.endX)

    return (
        <>
            <Dumbbell
                series={series}
                barY={0}
                chartAreaLeft={chartAreaLeft}
                chartAreaRight={chartAreaRight}
                dotRadius={dotRadius}
            />
            {/* Start value label (left side) */}
            <text
                x={minX - GAP__ENTITY_LABEL__DUMBBELL}
                y={0}
                fill={GRAPHER_DARK_TEXT}
                dy={dyFromAlign(VerticalAlign.middle)}
                textAnchor="end"
                opacity={style.labelOpacity}
                fontSize={valueLabelStyle.fontSize}
                fontWeight={valueLabelStyle.fontWeight}
            >
                {formatValue(series.start.value)}
            </text>
            {/* End value label (right side) */}
            <text
                x={maxX + GAP__ENTITY_LABEL__DUMBBELL}
                y={0}
                fill={GRAPHER_DARK_TEXT}
                dy={dyFromAlign(VerticalAlign.middle)}
                textAnchor="start"
                opacity={style.labelOpacity}
                fontSize={valueLabelStyle.fontSize}
                fontWeight={valueLabelStyle.fontWeight}
            >
                {formatValue(series.end.value)}
            </text>
        </>
    )
}
