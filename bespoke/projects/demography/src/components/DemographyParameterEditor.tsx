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
    ZERO_LINE_COLOR,
    USER_MODIFIED_COLOR,
    GRID_LINE_COLOR,
    GRID_LABEL_COLOR,
} from "../helpers/constants"
import { GRAPHER_LIGHT_TEXT } from "@ourworldindata/grapher/src/color/ColorConstants.js"
import { Halo, TextWrap } from "@ourworldindata/components"
import { Bounds } from "@ourworldindata/utils"
import { parameterConfigByKey } from "../helpers/parameterConfigs.js"
import { TimeAxisX } from "./TimeAxisX.js"
import { ParameterKey, type YearLabel } from "../helpers/types.js"
import { getParameterChartFonts } from "../helpers/fonts"
import { toBreakpoint } from "../helpers/useBreakpoint"
import { getInterpolatedValue } from "../model/projectionRunner"

const SMALL_DOT_RADIUS = 3
const CONTROL_POINT_RADIUS = 5
const CONTROL_POINT_HIT_RADIUS = 12

const LINE_COLOR = DENIM_BLUE
const LABEL_COLOR = DENIM_BLUE

const margin = { top: 0, right: 0, bottom: 14, left: 0 }

interface DemographyParameterEditorProps {
    simulation: Simulation
    variant: ParameterKey
    interactive?: boolean
    showProjectionLabel?: boolean
    maxGridLines?: number
    yMin?: number
}

const INTERACTIVE_X_TICK_LABELS: YearLabel[] = [
    { year: START_YEAR, position: "start" },
    { year: 2030, position: "middle" },
    { year: 2050, position: "middle" },
    { year: END_YEAR, position: "end" },
]

const STATIC_X_TICK_LABELS: YearLabel[] = [
    { year: START_YEAR, position: "start" },
    { year: HISTORICAL_END_YEAR, position: "middle" },
    { year: END_YEAR, position: "end" },
]

interface DataPoint {
    year: number
    value: number
}

interface PointLabelInfo {
    key: string
    x: number
    y?: number
    label?: string
    year: number
    yearAnchor: "start" | "middle" | "end"
    valueLabelAnchor?: "start" | "middle" | "end"
    tickColor?: string
    hidden: boolean
}

function DemographyParameterEditorContent({
    simulation,
    variant,
    interactive = true,
    showProjectionLabel = false,
    maxGridLines,
    yMin: yMinOverride,
    width,
    height,
}: DemographyParameterEditorProps & { width: number; height: number }) {
    const config = parameterConfigByKey[variant]
    const fonts = getParameterChartFonts(toBreakpoint(width))

    const [hoveredYear, setHoveredYear] = useState<number | null>(null)

    const { points: historicalDataPoints } = useMemo(
        () => config.computeHistorical(simulation),
        [simulation, config]
    )

    const { points: unwppProjectionPoints } = useMemo(
        () => config.computeUnwppProjection(simulation),
        [simulation, config]
    )

    const controlPoints = simulation.scenarioParams[variant]
    const referencePoints = simulation.unwppScenarioParams[variant]

    const unwppValues = unwppProjectionPoints.map((d) => d.value)
    const historicalValues = historicalDataPoints.map((d) => d.value)

    const minValue =
        yMinOverride ??
        Math.max(
            config.yFloor ?? -Infinity,
            Math.min(
                Math.min(...unwppValues) - config.yPadding,
                Math.min(...historicalValues)
            )
        )
    const maxValue = Math.max(
        Math.max(...unwppValues) + config.yPadding,
        Math.max(...historicalValues)
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
        nice: true,
        clamp: true,
    })

    const controlDataPoints: DataPoint[] = CONTROL_YEARS.map((y) => ({
        year: y,
        value: controlPoints[y],
    }))

    const firstHistoricalDataPoint = historicalDataPoints[0]
    const lastHistoricalDataPoint = historicalDataPoints.at(-1)!
    const lastProjectionDataPoint = controlDataPoints.at(-1)!

    const historicalEndX = xScale(HISTORICAL_END_YEAR)

    const isModified = simulation.modifiedParameters.has(variant)

    const xTickLabels = interactive
        ? INTERACTIVE_X_TICK_LABELS
        : STATIC_X_TICK_LABELS

    const showValueLabels = !interactive
    const axisColor = minValue === 0 ? ZERO_LINE_COLOR : GRID_LINE_COLOR

    const controlYearSet = new Set<number>(CONTROL_YEARS)
    const isHoveringControlPoint =
        interactive && hoveredYear !== null && controlYearSet.has(hoveredYear)

    // Look up hovered value — historical from data points, projection via interpolation
    const hoveredValue = useMemo(() => {
        if (hoveredYear === null) return undefined
        if (hoveredYear <= HISTORICAL_END_YEAR) {
            return historicalDataPoints.find((d) => d.year === hoveredYear)
                ?.value
        }
        // When unmodified, read from the fine-grained UN WPP data
        if (!isModified) {
            return unwppProjectionPoints.find((d) => d.year === hoveredYear)
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
        historicalDataPoints,
        controlPoints,
        lastHistoricalDataPoint,
        isModified,
        unwppProjectionPoints,
    ])

    const visiblePointLabels = useMemo(
        () =>
            findVisiblePointLabels({
                firstHistoricalDataPoint,
                lastHistoricalDataPoint,
                lastProjectionDataPoint,
                showValueLabels,
                axisColor,
                hoveredYear,
                hoveredValue,
                xScale,
                yScale,
                innerHeight,
                fonts,
                formatValue: config.formatValue,
            }),
        [
            firstHistoricalDataPoint,
            lastHistoricalDataPoint,
            lastProjectionDataPoint,
            showValueLabels,
            axisColor,
            hoveredYear,
            hoveredValue,
            xScale,
            yScale,
            innerHeight,
            fonts,
            config,
        ]
    )

    const hiddenXTickYears = useMemo(() => {
        if (hoveredYear === null) return undefined
        const hoverBounds = getXAxisLabelBounds({
            x: xScale(hoveredYear),
            innerHeight,
            year: hoveredYear,
            anchor: "middle",
            fontSize: fonts.xTick,
            labelOffset: YEAR_LABEL_OFFSET,
        })
        const hidden = new Set<number>()
        for (const { year, position } of xTickLabels) {
            const bounds = getXAxisLabelBounds({
                x: xScale(year),
                innerHeight,
                year,
                anchor: position,
                fontSize: fonts.xTick,
                labelOffset: YEAR_LABEL_OFFSET,
            })
            if (bounds.intersects(hoverBounds)) {
                hidden.add(year)
            }
        }
        return hidden.size > 0 ? hidden : undefined
    }, [hoveredYear, xScale, innerHeight, fonts, xTickLabels])

    const handleChange = useCallback(
        (newPoints: Record<number, number>) => {
            simulation.setScenarioParams({
                ...simulation.scenarioParams,
                [variant]: newPoints,
            })
        },
        [simulation, variant]
    )

    const handleMouseMove = useCallback(
        (e: React.MouseEvent<SVGRectElement>) => {
            const point = localPoint(e)
            if (!point) return
            const clampedX = Math.max(
                0,
                Math.min(point.x - margin.left, innerWidth)
            )
            const rawYear = (
                xScale as unknown as { invert: (x: number) => number }
            ).invert(clampedX)
            const rounded = Math.round(rawYear)

            if (rounded >= START_YEAR && rounded <= END_YEAR) {
                setHoveredYear(rounded)
            } else {
                setHoveredYear(null)
            }
        },
        [xScale, innerWidth]
    )

    const handleMouseLeave = useCallback(() => {
        setHoveredYear(null)
    }, [])

    return (
        <svg
            width={width + CONTROL_POINT_HIT_RADIUS}
            height={height}
            overflow="visible"
            style={{ display: "block", touchAction: "none" }}
        >
            <Group left={margin.left} top={margin.top}>
                {/* Projection area background */}
                <rect
                    x={historicalEndX}
                    y={0}
                    width={innerWidth - historicalEndX}
                    height={innerHeight}
                    fill={PROJECTION_BACKGROUND}
                />

                {/* Projection label */}
                {showProjectionLabel && (
                    <text
                        x={historicalEndX + 6}
                        y={fonts.projectionAnnotation + 2}
                        fontSize={fonts.projectionAnnotation}
                        fill={GRAPHER_LIGHT_TEXT}
                    >
                        Projections →
                    </text>
                )}

                {/* Y-axis grid lines and labels */}
                <YAxisGridLines
                    maxGridLines={maxGridLines}
                    innerHeight={innerHeight}
                    innerWidth={innerWidth}
                    minValue={minValue}
                    yScale={yScale}
                    axisUnit={config.axisUnit}
                    fontSize={fonts.yTick}
                />

                {/* X-axis */}
                <TimeAxisX
                    xScale={xScale}
                    innerWidth={innerWidth}
                    innerHeight={innerHeight}
                    strokeColor={axisColor}
                    fontSize={fonts.xTick}
                    labelOffset={YEAR_LABEL_OFFSET}
                    hiddenYears={hiddenXTickYears}
                    xTickLabels={xTickLabels}
                />

                {/* Zero line */}
                {minValue <= 0 && maxValue >= 0 && (
                    <line
                        x1={0}
                        y1={yScale(0)}
                        x2={innerWidth}
                        y2={yScale(0)}
                        stroke={ZERO_LINE_COLOR}
                        strokeWidth={1}
                    />
                )}

                {/* Historical line */}
                <LinePath
                    data={historicalDataPoints}
                    x={(d) => xScale(d.year)}
                    y={(d) => yScale(d.value)}
                    stroke={LINE_COLOR}
                    strokeWidth={2}
                />

                {/* UN WPP reference line — hidden when modified */}
                {(interactive || !isModified) && (
                    <LinePath
                        data={[
                            lastHistoricalDataPoint,
                            ...unwppProjectionPoints,
                        ]}
                        x={(d) => xScale(d.year)}
                        y={(d) => yScale(d.value)}
                        stroke={isModified ? BENCHMARK_LINE_COLOR : LINE_COLOR}
                        strokeWidth={2}
                        strokeDasharray="1,2"
                        strokeLinecap="butt"
                    />
                )}

                {/* Projection line — only shown when modified */}
                {isModified && (
                    <LinePath
                        data={[lastHistoricalDataPoint, ...controlDataPoints]}
                        x={(d) => xScale(d.year)}
                        y={(d) => yScale(d.value)}
                        stroke={interactive ? USER_MODIFIED_COLOR : LINE_COLOR}
                        strokeWidth={2}
                        strokeDasharray="1,2"
                        strokeLinecap="butt"
                    />
                )}

                {/* Endpoint labels (1950, 2023, 2100) */}
                {visiblePointLabels.map((pl) => (
                    <PointLabelWithYear
                        key={pl.key}
                        x={pl.x}
                        y={pl.y}
                        label={pl.label}
                        year={pl.year}
                        yearAnchor={pl.yearAnchor}
                        valueLabelAnchor={pl.valueLabelAnchor}
                        tickColor={pl.tickColor}
                        hidden={pl.hidden}
                        innerHeight={innerHeight}
                        color={LINE_COLOR}
                        labelColor={LABEL_COLOR}
                        fontSize={fonts.pointLabel}
                        hideTickMark
                    />
                ))}

                {/* Invisible interaction rect for hover */}
                <rect
                    x={-20}
                    y={0}
                    width={innerWidth + 40}
                    height={innerHeight}
                    fill="transparent"
                    onMouseMove={handleMouseMove}
                    onMouseLeave={handleMouseLeave}
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
                                textAnchor={
                                    hoveredYear === START_YEAR
                                        ? "start"
                                        : hoveredYear === END_YEAR
                                          ? "end"
                                          : "middle"
                                }
                                fontSize={fonts.pointLabel}
                                fill={GRAPHER_LIGHT_TEXT}
                            >
                                {hoveredYear}
                            </text>
                        </Halo>
                    </g>
                )}

                {/* UN WPP reference dots */}
                {interactive &&
                    CONTROL_YEARS.map((year) => (
                        <circle
                            key={`ref-${year}`}
                            cx={xScale(year)}
                            cy={yScale(referencePoints[year])}
                            r={SMALL_DOT_RADIUS}
                            fill={BENCHMARK_LINE_COLOR}
                        />
                    ))}

                {/* Draggable control points */}
                {interactive &&
                    CONTROL_YEARS.map((year) => {
                        const pointColor = isModified
                            ? USER_MODIFIED_COLOR
                            : DENIM_BLUE
                        return (
                            <DraggableControlPoint
                                key={year}
                                cx={xScale(year)}
                                cy={yScale(controlPoints[year])}
                                value={controlPoints[year]}
                                color={pointColor}
                                modified={isModified}
                                highlighted={hoveredYear === year}
                                formatValue={config.formatValue}
                                dragArrowFontSize={fonts.dragArrow}
                                controlLabelFontSize={fonts.controlLabel}
                                yScale={yScale}
                                marginTop={margin.top}
                                onValueChange={(value) =>
                                    handleChange({
                                        ...controlPoints,
                                        [year]: value,
                                    })
                                }
                                onMouseEnter={() => setHoveredYear(year)}
                                onMouseLeave={handleMouseLeave}
                            />
                        )
                    })}

                {/* Hover dot + value label — rendered above control points */}
                {hoveredYear !== null && hoveredValue !== undefined && (
                    <g style={{ pointerEvents: "none" }}>
                        <HoverPointLabel
                            x={xScale(hoveredYear)}
                            y={yScale(hoveredValue)}
                            label={
                                isHoveringControlPoint
                                    ? undefined
                                    : config.formatValue(hoveredValue)
                            }
                            color={
                                interactive &&
                                isModified &&
                                hoveredYear > HISTORICAL_END_YEAR
                                    ? USER_MODIFIED_COLOR
                                    : LINE_COLOR
                            }
                            fontSize={fonts.hoverLabel}
                            backgroundFill={
                                interactive &&
                                isModified &&
                                hoveredYear > HISTORICAL_END_YEAR
                                    ? USER_MODIFIED_COLOR
                                    : DENIM_BLUE
                            }
                        />
                    </g>
                )}
            </Group>
        </svg>
    )
}

export const DemographyParameterEditor = memo(
    function DemographyParameterEditor(props: DemographyParameterEditorProps) {
        const { parentRef, width, height } = useParentSize()
        return (
            <div ref={parentRef} className="responsive-container">
                {width > 0 && height > 0 && (
                    <DemographyParameterEditorContent
                        {...props}
                        width={width}
                        height={height}
                    />
                )}
            </div>
        )
    }
)

function DraggableControlPoint({
    cx,
    cy,
    value,
    color,
    modified = false,
    highlighted = false,
    formatValue,
    yScale,
    marginTop,
    dragArrowFontSize,
    controlLabelFontSize,
    onValueChange,
    onMouseEnter,
    onMouseLeave,
}: {
    cx: number
    cy: number
    value: number
    color: string
    modified?: boolean
    highlighted?: boolean
    formatValue: (v: number) => string
    yScale: { invert: (y: number) => number }
    marginTop: number
    dragArrowFontSize: number
    controlLabelFontSize: number
    onValueChange: (value: number) => void
    onMouseEnter?: () => void
    onMouseLeave?: () => void
}) {
    const [isDragging, setIsDragging] = useState(false)
    const showBackground = highlighted || isDragging

    return (
        <g>
            {/* Hit area */}
            <circle
                cx={cx}
                cy={cy}
                r={CONTROL_POINT_HIT_RADIUS}
                fill="transparent"
                cursor="ns-resize"
                style={{ touchAction: "none" }}
                onMouseEnter={onMouseEnter}
                onMouseLeave={onMouseLeave}
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

            {/* Visual elements — all pointer-events: none so the Halo doesn't block interaction */}
            <g style={{ pointerEvents: "none" }}>
                {/* ▲ above dot */}
                <text
                    x={cx}
                    y={cy - 7}
                    textAnchor="middle"
                    fontSize={dragArrowFontSize}
                    fill={color}
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
                />
                {/* ▼ below dot */}
                <text
                    x={cx}
                    y={cy + 12}
                    textAnchor="middle"
                    fontSize={dragArrowFontSize}
                    fill={color}
                >
                    ▼
                </text>

                {/* Value label — flips below the dot when near the top */}
                {showBackground ? (
                    <>
                        <TextBackground
                            x={cx}
                            y={cy < 20 ? cy + 22 : cy - 17}
                            text={formatValue(value)}
                            fontSize={controlLabelFontSize}
                            padX={4}
                            padY={2}
                            fill={modified ? USER_MODIFIED_COLOR : DENIM_BLUE}
                        />
                        <text
                            x={cx}
                            y={cy < 20 ? cy + 22 : cy - 17}
                            textAnchor="middle"
                            fontSize={controlLabelFontSize}
                            fontWeight={700}
                            fill="white"
                        >
                            {formatValue(value)}
                        </text>
                    </>
                ) : (
                    <Halo id="control-value-label" outlineWidth={3}>
                        <text
                            x={cx}
                            y={cy < 20 ? cy + 22 : cy - 17}
                            textAnchor="middle"
                            fontSize={controlLabelFontSize}
                            fontWeight={700}
                            fill={color}
                        >
                            {formatValue(value)}
                        </text>
                    </Halo>
                )}
            </g>
        </g>
    )
}

function findVisiblePointLabels({
    firstHistoricalDataPoint,
    lastHistoricalDataPoint,
    lastProjectionDataPoint,
    showValueLabels,
    axisColor,
    hoveredYear,
    hoveredValue,
    xScale,
    yScale,
    innerHeight,
    fonts,
    formatValue,
}: {
    firstHistoricalDataPoint: DataPoint
    lastHistoricalDataPoint: DataPoint
    lastProjectionDataPoint: DataPoint
    showValueLabels: boolean
    axisColor: string
    hoveredYear: number | null
    hoveredValue: number | undefined
    xScale: (v: number) => number
    yScale: (v: number) => number
    innerHeight: number
    fonts: { xTick: number; pointLabel: number }
    formatValue: (v: number) => string
}): PointLabelInfo[] {
    const candidates: {
        key: string
        year: number
        value: number
        yearAnchor: "start" | "middle" | "end"
        valueLabelAnchor?: "start" | "middle" | "end"
        tickColor?: string
    }[] = [
        {
            key: "first-historical",
            year: firstHistoricalDataPoint.year,
            value: firstHistoricalDataPoint.value,
            yearAnchor: "start",
            valueLabelAnchor: "start",
        },
        ...(showValueLabels
            ? [
                  {
                      key: "last-historical",
                      year: lastHistoricalDataPoint.year,
                      value: lastHistoricalDataPoint.value,
                      yearAnchor: "middle" as const,
                      tickColor: axisColor,
                  },
              ]
            : []),
        {
            key: "last-projection",
            year: lastProjectionDataPoint.year,
            value: lastProjectionDataPoint.value,
            yearAnchor: "end",
            valueLabelAnchor: "end",
        },
    ]

    // Compute hover bounds for overlap detection
    const hasHover = hoveredYear !== null && hoveredValue !== undefined
    const hoverXAxisLabelBounds = hasHover
        ? getXAxisLabelBounds({
              x: xScale(hoveredYear),
              innerHeight,
              year: hoveredYear,
              anchor: "middle",
              fontSize: fonts.xTick,
              labelOffset: YEAR_LABEL_OFFSET,
          })
        : undefined
    const hoverValueBounds = hasHover
        ? getPointLabelBounds({
              x: xScale(hoveredYear),
              y: yScale(hoveredValue),
              label: formatValue(hoveredValue),
              fontSize: fonts.pointLabel,
          })
        : undefined

    return candidates.map((c) => {
        const x = xScale(c.year)
        const formattedLabel = formatValue(c.value)

        // Check if this label overlaps the hover tooltip
        let hidden = false
        if (hoverXAxisLabelBounds) {
            const yearBounds = getXAxisLabelBounds({
                x,
                innerHeight,
                year: c.year,
                anchor: c.yearAnchor,
                fontSize: fonts.xTick,
                labelOffset: YEAR_LABEL_OFFSET,
            })
            if (yearBounds.intersects(hoverXAxisLabelBounds)) {
                hidden = true
            } else if (showValueLabels && hoverValueBounds) {
                const valueBounds = getPointLabelBounds({
                    x,
                    y: yScale(c.value),
                    label: formattedLabel,
                    fontSize: fonts.pointLabel,
                })
                if (valueBounds.intersects(hoverValueBounds)) {
                    hidden = true
                }
            }
        }

        return {
            key: c.key,
            x,
            y: showValueLabels ? yScale(c.value) : undefined,
            label: showValueLabels ? formattedLabel : undefined,
            year: c.year,
            yearAnchor: c.yearAnchor,
            valueLabelAnchor: c.valueLabelAnchor,
            tickColor: c.tickColor,
            hidden,
        }
    })
}

/** Compute the Bounds of a PointLabel's value text. */
function getPointLabelBounds({
    x,
    y,
    label,
    fontSize,
}: {
    x: number
    y: number
    label: string
    fontSize: number
}): Bounds {
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
function getXAxisLabelBounds({
    x,
    innerHeight,
    year,
    anchor,
    fontSize,
    labelOffset,
}: {
    x: number
    innerHeight: number
    year: number
    anchor: "start" | "middle" | "end"
    fontSize: number
    labelOffset: number
}): Bounds {
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

// Font sizes for standalone functions are passed as parameters from the main component
const YEAR_LABEL_OFFSET = 14

function YAxisGridLines({
    maxGridLines,
    innerHeight,
    innerWidth,
    minValue,
    yScale,
    axisUnit,
    fontSize,
}: {
    maxGridLines: number | undefined
    innerHeight: number
    innerWidth: number
    minValue: number
    yScale: ReturnType<typeof scaleLinear<number>>
    axisUnit: string
    fontSize: number
}) {
    const defaultCount = innerHeight < 80 ? 2 : 3
    let ticks = yScale
        .ticks(maxGridLines ?? defaultCount)
        .filter((t) => yScale(t) > 12 && yScale(t) < innerHeight - 4)
    if (maxGridLines !== undefined && ticks.length > maxGridLines)
        ticks = ticks.slice(0, maxGridLines)
    const topTick = ticks[ticks.length - 1]
    return (
        <>
            {ticks.map((tick) => (
                <g key={tick}>
                    <line
                        x1={0}
                        y1={yScale(tick)}
                        x2={innerWidth}
                        y2={yScale(tick)}
                        stroke={tick === 0 ? ZERO_LINE_COLOR : GRID_LINE_COLOR}
                        strokeWidth={1}
                    />
                    {(tick !== 0 || minValue < 0) && (
                        <text
                            x={0}
                            y={yScale(tick) - 4}
                            fontSize={fontSize}
                            fill={GRID_LABEL_COLOR}
                        >
                            {Math.round(tick * 10) / 10}
                            {axisUnit === "‰"
                                ? "‰"
                                : tick === topTick
                                  ? ` ${axisUnit}`
                                  : ""}
                        </text>
                    )}
                </g>
            ))}
        </>
    )
}

function PointLabel({
    x,
    y,
    label,
    color,
    labelColor,
    fontSize = 9,
    hidden = false,
    textAnchor = "middle",
}: {
    x: number
    y: number
    label?: string
    color: string
    labelColor?: string
    fontSize?: number
    hidden?: boolean
    textAnchor?: "start" | "middle" | "end"
}) {
    return (
        <>
            <circle cx={x} cy={y} r={SMALL_DOT_RADIUS} fill={color} />
            {label && (
                <Halo id="point-label" outlineWidth={3}>
                    <text
                        x={x}
                        y={y < 20 ? y + fontSize / 2 + 8 : y - fontSize / 2 - 3}
                        fontSize={fontSize}
                        fontWeight={700}
                        fill={labelColor ?? color}
                        textAnchor={textAnchor}
                        opacity={hidden ? 0 : 1}
                    >
                        {label}
                    </text>
                </Halo>
            )}
        </>
    )
}

function HoverPointLabel({
    x,
    y,
    label,
    color,
    fontSize = 9,
    backgroundFill = DENIM_BLUE,
}: {
    x: number
    y: number
    label?: string
    color: string
    fontSize?: number
    backgroundFill?: string
}) {
    const textY = y < 20 ? y + fontSize / 2 + 10 : y - fontSize / 2 - 5
    const padX = 4
    const padY = 2

    return (
        <>
            <circle cx={x} cy={y} r={SMALL_DOT_RADIUS} fill={color} />
            {label && (
                <>
                    <TextBackground
                        x={x}
                        y={textY}
                        text={label}
                        fontSize={fontSize}
                        padX={padX}
                        padY={padY}
                        fill={backgroundFill}
                    />
                    <text
                        x={x}
                        y={textY}
                        fontSize={fontSize}
                        fontWeight={700}
                        fill="white"
                        textAnchor="middle"
                    >
                        {label}
                    </text>
                </>
            )}
        </>
    )
}

function TextBackground({
    x,
    y,
    text,
    fontSize,
    padX,
    padY,
    fill,
}: {
    x: number
    y: number
    text: string
    fontSize: number
    padX: number
    padY: number
    fill: string
}) {
    const tw = new TextWrap({ text, maxWidth: Infinity, fontSize })
    return (
        <rect
            x={x - tw.width / 2 - padX}
            y={y - tw.height + padY}
            width={tw.width + padX * 2}
            height={tw.height + padY}
            rx={2}
            fill={fill}
        />
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
    valueLabelAnchor,
    hidden = false,
    hideTickMark = false,
    tickColor = GRAPHER_LIGHT_TEXT,
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
    valueLabelAnchor?: "start" | "middle" | "end"
    hidden?: boolean
    hideTickMark?: boolean
    tickColor?: string
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
                    textAnchor={valueLabelAnchor}
                />
            )}
            {/* Year tick */}
            {!hideTickMark && (
                <line
                    x1={x}
                    y1={innerHeight}
                    x2={x}
                    y2={innerHeight + 5}
                    stroke={tickColor}
                    opacity={hidden ? 0 : 1}
                />
            )}
            {/* Year label */}
            <Halo id="point-year-label" outlineWidth={3}>
                <text
                    x={x}
                    y={innerHeight + YEAR_LABEL_OFFSET}
                    textAnchor={yearAnchor}
                    fontSize={fontSize}
                    fill={GRAPHER_LIGHT_TEXT}
                    opacity={hidden ? 0 : 1}
                >
                    {year}
                </text>
            </Halo>
        </>
    )
}
