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
    HOVER_LINE_COLOR,
} from "../helpers/constants"
import { GRAPHER_LIGHT_TEXT } from "@ourworldindata/grapher/src/color/ColorConstants.js"
import { Halo, TextWrap } from "@ourworldindata/components"
import { Bounds } from "@ourworldindata/utils"
import { parameterConfigByKey } from "../helpers/parameterConfigs.js"
import { TimeAxisX } from "./TimeAxisX.js"
import { ParameterKey } from "../helpers/types.js"
import { getInterpolatedValue } from "../model/projectionRunner.js"

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
    lineColor?: string
    labelColor?: string
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
    lineColor = DENIM_BLUE,
    labelColor = DENIM_BLUE,
    showProjectionLabel = false,
    valueLabelFontSize = 9,
    width,
    height,
}: DemographyParameterEditorProps & { width: number; height: number }) {
    const config = parameterConfigByKey[variant]
    const [hoveredYear, setHoveredYear] = useState<number | null>(null)

    const {
        points: historicalDataPoints,
        min: minValue,
        max: maxValue,
    } = useMemo(
        () => config.computeHistorical(simulation, interactive),
        [simulation, config, interactive]
    )

    const controlPoints = simulation.scenarioParams[variant]
    const referencePoints = simulation.unwppScenarioParams[variant]
    const formatValue = config.formatValue

    const handleChange = useCallback(
        (newPoints: Record<number, number>) => {
            simulation.setScenarioParams({
                ...simulation.scenarioParams,
                [variant]: newPoints,
            })
        },
        [simulation, variant]
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

    const handlePointerMove = useCallback(
        (e: React.PointerEvent<SVGRectElement>) => {
            const point = localPoint(e)
            if (!point) return
            const rawYear = (
                xScale as unknown as { invert: (x: number) => number }
            ).invert(point.x - margin.left)
            const rounded = Math.round(rawYear)

            if (rounded >= START_YEAR && rounded <= END_YEAR) {
                setHoveredYear(rounded)
            } else {
                setHoveredYear(null)
            }
        },
        [xScale]
    )

    const handlePointerLeave = useCallback(() => {
        setHoveredYear(null)
    }, [])

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

    // Look up hovered value — historical from data points, projection via interpolation
    // In interactive mode, skip control years since they already have labels from DraggableControlPoint
    const isControlYear =
        interactive &&
        hoveredYear !== null &&
        (CONTROL_YEARS as readonly number[]).includes(hoveredYear)
    const hoveredValue = useMemo(() => {
        if (hoveredYear === null || isControlYear) return undefined
        if (hoveredYear <= HISTORICAL_END_YEAR) {
            return historicalDataPoints.find((d) => d.year === hoveredYear)
                ?.value
        }
        // Augment control points with the historical anchor at HISTORICAL_END_YEAR
        // so interpolation between 2023 and 2030 is correct
        const augmentedPoints = {
            [HISTORICAL_END_YEAR]: lastHistoricalDataPoint.value,
            ...controlPoints,
        }
        const augmentedControlYears = [HISTORICAL_END_YEAR, ...CONTROL_YEARS]
        return getInterpolatedValue(
            augmentedPoints,
            hoveredYear,
            HISTORICAL_END_YEAR,
            augmentedControlYears
        )
    }, [
        hoveredYear,
        isControlYear,
        historicalDataPoints,
        controlPoints,
        lastHistoricalDataPoint,
    ])

    // Determine which static PointLabelWithYear elements overlap the hover elements.
    // If either the year label or value label overlaps, hide both together.
    const hiddenPointLabels = useMemo(() => {
        const hidden = new Set<string>()
        if (hoveredYear === null) return hidden

        const hx = xScale(hoveredYear)

        // Hover year label bounds (always present)
        const hoverYearBounds = yearLabelBounds(
            hx,
            innerHeight,
            hoveredYear,
            "middle",
            YEAR_LABEL_FONT_SIZE,
            YEAR_LABEL_OFFSET
        )

        // Hover value label bounds (only when hoveredValue is defined)
        const hoverValueBounds =
            hoveredValue !== undefined
                ? pointLabelBounds(
                      hx,
                      yScale(hoveredValue),
                      formatValue(hoveredValue),
                      valueLabelFontSize
                  )
                : undefined

        interface StaticLabel {
            key: string
            year: number
            yearAnchor: "start" | "middle" | "end"
            x: number
            valueBounds?: Bounds
        }

        const statics: StaticLabel[] = [
            {
                key: "first-historical",
                year: firstHistoricalDataPoint.year,
                yearAnchor: "start",
                x: xScale(firstHistoricalDataPoint.year),
                valueBounds: pointLabelBounds(
                    xScale(firstHistoricalDataPoint.year),
                    yScale(firstHistoricalDataPoint.value),
                    formatValue(firstHistoricalDataPoint.value),
                    valueLabelFontSize
                ),
            },
            {
                key: "last-historical",
                year: lastHistoricalDataPoint.year,
                yearAnchor: "middle",
                x: xScale(lastHistoricalDataPoint.year),
                valueBounds: !interactive
                    ? pointLabelBounds(
                          xScale(lastHistoricalDataPoint.year),
                          yScale(lastHistoricalDataPoint.value),
                          formatValue(lastHistoricalDataPoint.value),
                          valueLabelFontSize
                      )
                    : undefined,
            },
        ]

        if (projectionPoints.length > 0) {
            const last = projectionPoints.at(-1)!
            statics.push({
                key: "last-projection",
                year: last.year,
                yearAnchor: "end",
                x: xScale(last.year),
                valueBounds: !interactive
                    ? pointLabelBounds(
                          xScale(last.year),
                          yScale(last.value),
                          formatValue(last.value),
                          valueLabelFontSize
                      )
                    : undefined,
            })
        }

        for (const s of statics) {
            const sYearBounds = yearLabelBounds(
                s.x,
                innerHeight,
                s.year,
                s.yearAnchor,
                YEAR_LABEL_FONT_SIZE,
                YEAR_LABEL_OFFSET
            )

            // Check year-vs-year overlap
            if (sYearBounds.intersects(hoverYearBounds)) {
                hidden.add(s.key)
                continue
            }

            // Check value-vs-value overlap
            if (s.valueBounds && hoverValueBounds) {
                if (s.valueBounds.intersects(hoverValueBounds)) {
                    hidden.add(s.key)
                }
            }
        }
        return hidden
    }, [
        hoveredYear,
        hoveredValue,
        xScale,
        yScale,
        innerHeight,
        formatValue,
        valueLabelFontSize,
        firstHistoricalDataPoint,
        lastHistoricalDataPoint,
        projectionPoints,
        interactive,
    ])

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
                    <Halo id="projection-label" outlineWidth={3}>
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
                    fontSize={YEAR_LABEL_FONT_SIZE}
                    labelOffset={YEAR_LABEL_OFFSET}
                    hideLabels={hoveredYear !== null}
                />

                {/* Historical line */}
                <LinePath
                    data={historicalDataPoints}
                    x={(d) => xScale(d.year)}
                    y={(d) => yScale(d.value)}
                    stroke={lineColor}
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
                    stroke={lineColor}
                    strokeWidth={2}
                    strokeDasharray="1,2"
                    strokeLinecap="butt"
                />

                {/* First historical point (1950) — always with value label */}
                <PointLabelWithYear
                    x={xScale(firstHistoricalDataPoint.year)}
                    y={yScale(firstHistoricalDataPoint.value)}
                    innerHeight={innerHeight}
                    label={formatValue(firstHistoricalDataPoint.value)}
                    color={lineColor}
                    labelColor={labelColor}
                    fontSize={valueLabelFontSize}
                    year={firstHistoricalDataPoint.year}
                    yearAnchor="start"
                    hidden={hiddenPointLabels.has("first-historical")}
                />

                {/* Last historical point (2023) */}
                <PointLabelWithYear
                    x={xScale(lastHistoricalDataPoint.year)}
                    y={
                        !interactive
                            ? yScale(lastHistoricalDataPoint.value)
                            : undefined
                    }
                    innerHeight={innerHeight}
                    label={
                        !interactive
                            ? formatValue(lastHistoricalDataPoint.value)
                            : undefined
                    }
                    color={lineColor}
                    labelColor={labelColor}
                    fontSize={valueLabelFontSize}
                    year={lastHistoricalDataPoint.year}
                    yearAnchor="middle"
                    hidden={hiddenPointLabels.has("last-historical")}
                />

                {/* Last projection point (2100) */}
                {projectionPoints.length > 0 && (
                    <PointLabelWithYear
                        x={xScale(projectionPoints.at(-1)!.year)}
                        y={
                            !interactive
                                ? yScale(projectionPoints.at(-1)!.value)
                                : undefined
                        }
                        innerHeight={innerHeight}
                        label={
                            !interactive
                                ? formatValue(projectionPoints.at(-1)!.value)
                                : undefined
                        }
                        color={lineColor}
                        labelColor={labelColor}
                        fontSize={valueLabelFontSize}
                        year={projectionPoints.at(-1)!.year}
                        yearAnchor="end"
                        hidden={hiddenPointLabels.has("last-projection")}
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

                {/* Invisible interaction rect for hover — placed before control points so they get priority */}
                <rect
                    x={0}
                    y={0}
                    width={innerWidth}
                    height={innerHeight}
                    fill="transparent"
                    onPointerMove={handlePointerMove}
                    onPointerLeave={handlePointerLeave}
                />

                {/* Hover elements */}
                {hoveredYear !== null && (
                    <g style={{ pointerEvents: "none" }}>
                        {/* Vertical line */}
                        <line
                            x1={xScale(hoveredYear)}
                            y1={0}
                            x2={xScale(hoveredYear)}
                            y2={innerHeight}
                            stroke={HOVER_LINE_COLOR}
                            strokeWidth={1}
                        />

                        {/* Year tick + label below x-axis */}
                        <line
                            x1={xScale(hoveredYear)}
                            y1={innerHeight}
                            x2={xScale(hoveredYear)}
                            y2={innerHeight + 5}
                            stroke={GRAPHER_LIGHT_TEXT}
                        />
                        <Halo id="hover-year-label" outlineWidth={3}>
                            <text
                                x={xScale(hoveredYear)}
                                y={innerHeight + 14}
                                textAnchor="middle"
                                fontSize={9}
                                fill={GRAPHER_LIGHT_TEXT}
                            >
                                {hoveredYear}
                            </text>
                        </Halo>

                        {/* Dot + value label */}
                        {hoveredValue !== undefined && (
                            <PointLabel
                                x={xScale(hoveredYear)}
                                y={yScale(hoveredValue)}
                                label={formatValue(hoveredValue)}
                                color={lineColor}
                                labelColor={labelColor}
                                fontSize={valueLabelFontSize}
                            />
                        )}
                    </g>
                )}

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
                            onPointerEnter={() => setHoveredYear(year)}
                            onPointerLeave={handlePointerLeave}
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
        lineColor,
        labelColor,
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
                        lineColor={lineColor}
                        labelColor={labelColor}
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
    onPointerEnter,
    onPointerLeave,
}: {
    cx: number
    cy: number
    value: number
    color: string
    formatValue: (v: number) => string
    yScale: { invert: (y: number) => number }
    marginTop: number
    onValueChange: (value: number) => void
    onPointerEnter?: () => void
    onPointerLeave?: () => void
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
                onPointerEnter={onPointerEnter}
                onPointerLeave={onPointerLeave}
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
            <Halo id="control-value-label" outlineWidth={3}>
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

/** Compute the Bounds of a PointLabel's value text. */
function pointLabelBounds(
    x: number,
    y: number,
    label: string,
    fontSize: number
): Bounds {
    const tw = new TextWrap({ text: label, maxWidth: Infinity, fontSize })
    const textY = y - fontSize / 2 - 3
    return new Bounds(
        x - tw.width / 2,
        textY - tw.height,
        tw.width,
        tw.height
    ).expand(2)
}

/** Compute the Bounds of a year label below the x-axis. */
function yearLabelBounds(
    x: number,
    innerHeight: number,
    year: number,
    anchor: "start" | "middle" | "end",
    fontSize: number,
    labelOffset: number
): Bounds {
    const tw = new TextWrap({
        text: String(year),
        maxWidth: Infinity,
        fontSize,
    })
    const bx =
        anchor === "start"
            ? x
            : anchor === "end"
              ? x - tw.width
              : x - tw.width / 2
    return new Bounds(
        bx,
        innerHeight + labelOffset - tw.height,
        tw.width,
        tw.height
    ).expand(2)
}

const YEAR_LABEL_FONT_SIZE = 9
const YEAR_LABEL_OFFSET = 14

function PointLabel({
    x,
    y,
    label,
    color,
    labelColor,
    fontSize = 9,
    hidden = false,
}: {
    x: number
    y: number
    label?: string
    color: string
    labelColor?: string
    fontSize?: number
    hidden?: boolean
}) {
    return (
        <>
            <circle cx={x} cy={y} r={SMALL_DOT_RADIUS} fill={color} />
            {label && (
                <Halo id="point-label" outlineWidth={3}>
                    <text
                        x={x}
                        y={y - fontSize / 2 - 3}
                        fontSize={fontSize}
                        fill={labelColor ?? color}
                        textAnchor="middle"
                        opacity={hidden ? 0 : 1}
                    >
                        {label}
                    </text>
                </Halo>
            )}
        </>
    )
}

function PointLabelWithYear({
    x,
    y,
    innerHeight,
    label,
    color,
    labelColor,
    fontSize = 9,
    year,
    yearAnchor = "middle",
    hidden = false,
}: {
    x: number
    y?: number
    innerHeight: number
    label?: string
    color: string
    labelColor?: string
    fontSize?: number
    year: number
    yearAnchor?: "start" | "middle" | "end"
    hidden?: boolean
}) {
    return (
        <>
            {y !== undefined && (
                <PointLabel
                    x={x}
                    y={y}
                    label={label}
                    color={color}
                    labelColor={labelColor}
                    fontSize={fontSize}
                    hidden={hidden}
                />
            )}
            {/* Year tick */}
            <line
                x1={x}
                y1={innerHeight}
                x2={x}
                y2={innerHeight + 5}
                stroke={GRAPHER_LIGHT_TEXT}
                opacity={hidden ? 0 : 1}
            />
            {/* Year label */}
            <Halo id="point-year-label" outlineWidth={3}>
                <text
                    x={x}
                    y={innerHeight + YEAR_LABEL_OFFSET}
                    textAnchor={yearAnchor}
                    fontSize={YEAR_LABEL_FONT_SIZE}
                    fill={GRAPHER_LIGHT_TEXT}
                    opacity={hidden ? 0 : 1}
                >
                    {year}
                </text>
            </Halo>
        </>
    )
}
