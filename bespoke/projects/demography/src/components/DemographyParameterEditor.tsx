import { memo, useState, useMemo, useCallback } from "react"
import { useParentSize } from "@visx/responsive"
import { scaleLinear } from "@visx/scale"
import { LinePath } from "@visx/shape"
import { Group } from "@visx/group"
import { localPoint } from "@visx/event"
import type { Simulation } from "../helpers/useSimulation"
import {
    CONTROL_YEARS,
    HISTORICAL_END_YEAR,
    PROJECTION_BACKGROUND,
    START_YEAR,
    END_YEAR,
    DENIM_BLUE,
    BENCHMARK_LINE_COLOR,
} from "../helpers/constants"
import { GRAPHER_LIGHT_TEXT } from "@ourworldindata/grapher/src/color/ColorConstants.js"
import { Halo } from "@ourworldindata/components"
import { parameterConfigByKey } from "../helpers/parameterConfigs.js"
import { TimeAxisX } from "./TimeAxisX.js"
import { ParameterKey } from "../helpers/types.js"

const SMALL_DOT_RADIUS = 3
const CONTROL_POINT_RADIUS = 5
const CONTROL_POINT_HIT_RADIUS = 12
const margin = {
    top: 0,
    right: 0.5 * CONTROL_POINT_HIT_RADIUS,
    bottom: 14,
    left: 0.5 * SMALL_DOT_RADIUS,
}

interface DemographyParameterEditorProps {
    simulation: Simulation
    variant: ParameterKey
    interactive?: boolean
    showProjectionLabel?: boolean
    valueLabelFontSize?: number
}

interface DataPoint {
    year: number
    value: number
}

function DemographyParameterEditor({
    simulation,
    variant,
    interactive = true,
    showProjectionLabel = false,
    valueLabelFontSize = 9,
    width,
    height,
}: DemographyParameterEditorProps & { width: number; height: number }) {
    const config = parameterConfigByKey[variant]
    const { paramKey } = config

    const {
        points: historicalDataPoints,
        min: minValue,
        max: maxValue,
    } = useMemo(
        () => config.computeHistorical(simulation, interactive),
        [simulation, config, interactive]
    )

    const controlPoints = simulation.scenarioParams[paramKey]
    const referencePoints = simulation.unwppScenarioParams[paramKey]
    const formatValue = config.formatValue

    const handleChange = useCallback(
        (newPoints: Record<number, number>) => {
            simulation.setScenarioParams({
                ...simulation.scenarioParams,
                [paramKey]: newPoints,
            })
        },
        [simulation, paramKey]
    )

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

    const projectionPoints: DataPoint[] = CONTROL_YEARS.map((y) => ({
        year: y,
        value: controlPoints[y],
    }))
    const referenceDataPoints: DataPoint[] = CONTROL_YEARS.map((y) => ({
        year: y,
        value: referencePoints[y],
    }))

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

                {/* Projection label */}
                {showProjectionLabel && (
                    <Halo
                        id="projection-label"
                        outlineWidth={2}
                        outlineColor={PROJECTION_BACKGROUND}
                    >
                        <text
                            x={projX + 6}
                            y={12}
                            fontSize={10}
                            fill={GRAPHER_LIGHT_TEXT}
                        >
                            Projections →
                        </text>
                    </Halo>
                )}

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
                <TimeAxisX
                    xScale={xScale}
                    innerWidth={innerWidth}
                    innerHeight={innerHeight}
                    strokeColor={minValue === 0 ? GRAPHER_LIGHT_TEXT : "#ddd"}
                    fontSize={9}
                    labelOffset={14}
                />

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
                    fontSize={valueLabelFontSize}
                />

                {/* Dot and label for last historical point (non-interactive) */}
                {!interactive && (
                    <PointLabel
                        x={xScale(lastHistoricalDataPoint.year)}
                        y={yScale(lastHistoricalDataPoint.value)}
                        label={formatValue(lastHistoricalDataPoint.value)}
                        color={DENIM_BLUE}
                        fontSize={valueLabelFontSize}
                    />
                )}

                {/* Dot and label for last projection point (non-interactive) */}
                {!interactive && projectionPoints.length > 0 && (
                    <PointLabel
                        x={xScale(projectionPoints.at(-1)!.year)}
                        y={yScale(projectionPoints.at(-1)!.value)}
                        label={formatValue(projectionPoints.at(-1)!.value)}
                        color={DENIM_BLUE}
                        fontSize={valueLabelFontSize}
                    />
                )}

                {/* UN WPP reference dots at control years */}
                {interactive &&
                    CONTROL_YEARS.map((year) => (
                        <PointLabel
                            key={year}
                            x={xScale(year)}
                            y={yScale(referencePoints[year])}
                            color={BENCHMARK_LINE_COLOR}
                        />
                    ))}

                {/* Draggable control points */}
                {interactive &&
                    CONTROL_YEARS.map((year) => (
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
                                handleChange({
                                    ...controlPoints,
                                    [year]: value,
                                })
                            }
                        />
                    ))}
            </Group>
        </svg>
    )
}

export const ResponsiveDemographyParameterEditor = memo(
    function ResponsiveDemographyParameterEditor({
        simulation,
        variant,
        interactive,
        showProjectionLabel,
        valueLabelFontSize,
    }: DemographyParameterEditorProps) {
        const { parentRef, width, height } = useParentSize()
        return (
            <div ref={parentRef} style={{ width: "100%", height: "100%" }}>
                {width > 0 && height > 0 ? (
                    <DemographyParameterEditor
                        simulation={simulation}
                        variant={variant}
                        interactive={interactive}
                        showProjectionLabel={showProjectionLabel}
                        valueLabelFontSize={valueLabelFontSize}
                        width={width}
                        height={height}
                    />
                ) : null}
            </div>
        )
    }
)

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
