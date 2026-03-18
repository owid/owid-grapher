import { useState } from "react"
import { ParentSize } from "@visx/responsive"
import { scaleLinear } from "@visx/scale"
import { LinePath } from "@visx/shape"
import { Group } from "@visx/group"
import { localPoint } from "@visx/event"
import {
    CONTROL_YEARS,
    HISTORICAL_END_YEAR,
    PROJECTION_BACKGROUND,
    START_YEAR,
    END_YEAR,
    DENIM_BLUE,
    BENCHMARK_LINE_COLOR,
} from "./demography/constants.js"
import { GRAPHER_LIGHT_TEXT } from "@ourworldindata/grapher/src/color/ColorConstants.js"
import { Halo } from "@ourworldindata/components"
import { DemographyAxisX } from "./demography/DemographyAxisX.js"

const SMALL_DOT_RADIUS = 3
const CONTROL_POINT_RADIUS = 5
const CONTROL_POINT_HIT_RADIUS = 12
const margin = {
    top: 0,
    right: 0.5 * CONTROL_POINT_HIT_RADIUS,
    bottom: 14,
    left: 0.5 * SMALL_DOT_RADIUS,
}

interface DataPoint {
    year: number
    value: number
}

interface TrajectoryEditorProps {
    historicalDataPoints: DataPoint[]
    controlPoints: Record<number, number>
    referencePoints: Record<number, number>
    minValue: number
    maxValue: number
    formatValue: (v: number) => string
    color: string
    onChange: (points: Record<number, number>) => void
}

export function ResponsiveTrajectoryEditor(props: TrajectoryEditorProps) {
    return (
        <ParentSize>
            {({ width, height }) =>
                width > 0 && height > 0 ? (
                    <TrajectoryEditor
                        {...props}
                        width={width}
                        height={height}
                    />
                ) : null
            }
        </ParentSize>
    )
}

function TrajectoryEditor({
    historicalDataPoints,
    controlPoints,
    referencePoints,
    minValue,
    maxValue,
    formatValue,
    onChange,
    width,
    height,
}: TrajectoryEditorProps & { width: number; height: number }) {
    const innerWidth = width - margin.left - margin.right
    const innerHeight = height - margin.top - margin.bottom

    const xScale = scaleLinear({
        domain: [START_YEAR, END_YEAR],
        range: [0, innerWidth],
    })

    const yScale = scaleLinear({
        domain: [minValue, maxValue],
        range: [innerHeight, 0],
        clamp: true,
    })

    const firstHistoricalDataPoint = historicalDataPoints[0]
    const lastHistoricalDataPoint = historicalDataPoints.at(-1)!

    // Build data points for the user's assumptions and the UN reference
    const projectionPoints: DataPoint[] = CONTROL_YEARS.map((y) => ({
        year: y,
        value: controlPoints[y],
    }))
    const referenceDataPoints: DataPoint[] = CONTROL_YEARS.map((y) => ({
        year: y,
        value: referencePoints[y],
    }))

    // Projection background rect
    const projX = xScale(HISTORICAL_END_YEAR)

    return (
        <svg
            width={width}
            height={height}
            overflow="visible"
            style={{ display: "block" }}
        >
            <Group left={margin.left} top={margin.top}>
                {/* Projection area background */}
                <rect
                    x={projX}
                    y={0}
                    width={innerWidth - projX}
                    height={innerHeight}
                    fill={PROJECTION_BACKGROUND}
                />

                {/* Zero line */}
                {minValue <= 0 && maxValue >= 0 && (
                    <line
                        x1={0}
                        y1={yScale(0)}
                        x2={innerWidth}
                        y2={yScale(0)}
                        stroke="#767676"
                        strokeWidth={1}
                    />
                )}

                {/* X-axis */}
                <DemographyAxisX
                    xScale={xScale}
                    innerWidth={innerWidth}
                    innerHeight={innerHeight}
                    strokeColor={minValue === 0 ? GRAPHER_LIGHT_TEXT : "#ddd"}
                    fontSize={9}
                    labelOffset={14}
                />

                {/* Projections label */}
                {/* <text
                    x={projX + 6}
                    y={12}
                    fontSize={9.5}
                    fill={GRAPHER_LIGHT_TEXT}
                >
                    Projections →
                </text> */}

                {/* Historical line */}
                <LinePath
                    data={historicalDataPoints}
                    x={(d) => xScale(d.year)}
                    y={(d) => yScale(d.value)}
                    stroke={DENIM_BLUE}
                    strokeWidth={2}
                />

                {/* UN WPP reference line */}
                <LinePath
                    data={[lastHistoricalDataPoint, ...referenceDataPoints]}
                    x={(d) => xScale(d.year)}
                    y={(d) => yScale(d.value)}
                    stroke={BENCHMARK_LINE_COLOR}
                    strokeWidth={2}
                    strokeDasharray="1,2"
                    strokeLinecap="butt"
                />

                {/* Projection line */}
                <LinePath
                    data={[lastHistoricalDataPoint, ...projectionPoints]}
                    x={(d) => xScale(d.year)}
                    y={(d) => yScale(d.value)}
                    stroke={DENIM_BLUE}
                    strokeWidth={2}
                    strokeDasharray="1,2"
                    strokeLinecap="butt"
                />

                {/* Dot and label for first historical point */}
                <PointLabel
                    x={xScale(firstHistoricalDataPoint.year)}
                    y={yScale(firstHistoricalDataPoint.value)}
                    label={formatValue(firstHistoricalDataPoint.value)}
                    color={DENIM_BLUE}
                />

                {/* UN WPP reference dots at control years */}
                {CONTROL_YEARS.map((year) => (
                    <PointLabel
                        key={year}
                        x={xScale(year)}
                        y={yScale(referencePoints[year])}
                        color={BENCHMARK_LINE_COLOR}
                    />
                ))}

                {/* Draggable control points */}
                {CONTROL_YEARS.map((year) => (
                    <DraggableControlPoint
                        key={year}
                        cx={xScale(year)}
                        cy={yScale(controlPoints[year])}
                        value={controlPoints[year]}
                        color={DENIM_BLUE}
                        formatValue={formatValue}
                        yScale={yScale}
                        marginTop={margin.top}
                        onValueChange={(value) =>
                            onChange({ ...controlPoints, [year]: value })
                        }
                    />
                ))}
            </Group>
        </svg>
    )
}

function DraggableControlPoint({
    cx,
    cy,
    value,
    color,
    formatValue,
    yScale,
    marginTop,
    onValueChange,
}: {
    cx: number
    cy: number
    value: number
    color: string
    formatValue: (v: number) => string
    yScale: { invert: (y: number) => number }
    marginTop: number
    onValueChange: (value: number) => void
}) {
    const [isDragging, setIsDragging] = useState(false)

    return (
        <g>
            {/* Hit area */}
            <circle
                cx={cx}
                cy={cy}
                r={CONTROL_POINT_HIT_RADIUS}
                fill="transparent"
                cursor="ns-resize"
                onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId)
                    setIsDragging(true)
                }}
                onPointerMove={(e) => {
                    if (!isDragging) return
                    const point = localPoint(e)
                    if (!point) return
                    onValueChange(yScale.invert(point.y - marginTop))
                }}
                onPointerUp={() => {
                    setIsDragging(false)
                }}
            />

            {/* ▲ above dot */}
            <text
                x={cx}
                y={cy - 7}
                textAnchor="middle"
                fontSize={7}
                fill={color}
                style={{ pointerEvents: "none" }}
            >
                ▲
            </text>

            {/* Visible circle */}
            <circle
                cx={cx}
                cy={cy}
                r={CONTROL_POINT_RADIUS}
                fill="white"
                stroke={color}
                strokeWidth={2}
                cursor="ns-resize"
                style={{ pointerEvents: "none" }}
            />
            {/* ▼ below dot */}
            <text
                x={cx}
                y={cy + 12}
                textAnchor="middle"
                fontSize={7}
                fill={color}
                style={{ pointerEvents: "none" }}
            >
                ▼
            </text>

            {/* Value label — flips below the dot when near the top */}
            <Halo
                id="control-value-label"
                outlineWidth={4}
                outlineColor={PROJECTION_BACKGROUND}
            >
                <text
                    x={cx}
                    y={cy < 20 ? cy + 22 : cy - 15}
                    textAnchor="middle"
                    fontSize={9}
                    fontWeight={500}
                    fill={color}
                    style={{ pointerEvents: "none" }}
                >
                    {formatValue(value)}
                </text>
            </Halo>
        </g>
    )
}

function PointLabel({
    x,
    y,
    label,
    color,
    fontSize = 9,
}: {
    x: number
    y: number
    label?: string
    color: string
    fontSize?: number
}) {
    return (
        <>
            <circle cx={x} cy={y} r={SMALL_DOT_RADIUS} fill={color} />
            {label && (
                <Halo id="point-label" outlineWidth={2}>
                    <text
                        x={x}
                        y={y - fontSize / 2 - 2}
                        fontSize={fontSize}
                        fill={color}
                        textAnchor="middle"
                    >
                        {label}
                    </text>
                </Halo>
            )}
        </>
    )
}
