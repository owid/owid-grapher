import { useCallback, useMemo, useState } from "react"
import { useParentSize } from "@visx/responsive"
import { scaleLinear } from "@visx/scale"
import { LinePath } from "@visx/shape"
import { Group } from "@visx/group"
import { localPoint } from "@visx/event"
import { formatValue, GrapherTooltipAnchor } from "@ourworldindata/utils"
import {
    GRAPHER_DARK_TEXT,
    GRAPHER_LIGHT_TEXT,
} from "@ourworldindata/grapher/src/color/ColorConstants.js"
import { TooltipCard } from "@ourworldindata/grapher/src/tooltip/TooltipCard.js"
import { TooltipValue } from "@ourworldindata/grapher/src/tooltip/TooltipContents.js"
import { usePinnedTooltip } from "../../../../hooks/usePinnedTooltip.js"
import type { Simulation } from "../helpers/useSimulation.js"
import {
    BENCHMARK_LINE_COLOR,
    COLOR_CHILDREN,
    COLOR_WORKING,
    CONTROL_YEARS,
    END_YEAR,
    FULL_TIME_RANGE,
    GRID_LABEL_COLOR,
    GRID_LINE_COLOR,
    HISTORICAL_END_YEAR,
    PROJECTION_BACKGROUND,
    PROJECTION_DASHARRAY,
    START_YEAR,
    USER_MODIFIED_COLOR_LIGHT,
    WORKING_AGE,
} from "../helpers/constants.js"
import {
    clampRetirementAge,
    getDependencyBreakdownForYear,
    getRetirementAgeForYear,
    MAX_RETIREMENT_AGE,
    MIN_RETIREMENT_AGE,
    type DependencyAgeBreakdown,
    type RetirementAgePoints,
} from "../helpers/dependencyRatio.js"
import { parameterConfigByKey } from "../helpers/parameterConfigs.js"
import { getInterpolatedValue } from "../model/projectionRunner.js"
import { TimeAxisX } from "./TimeAxisX.js"

const DEPENDENT_OLD_COLOR = USER_MODIFIED_COLOR_LIGHT
const DEPENDENT_YOUNG_COLOR = COLOR_CHILDREN
const WORKING_COLOR = COLOR_WORKING
const retirementChartMargin = { top: 6, right: 2, bottom: 16, left: 28 }
const compactChartMargin = { top: 8, right: 2, bottom: 16, left: 36 }

interface DataPoint {
    year: number
    value: number
}

interface AgeShareDataPoint {
    year: number
    youngPct: number
    workingPct: number
    oldPct: number
}

interface HoverState {
    year: number
    lineX: number
    cursorX: number
    cursorY: number
}

interface RetirementAgeEditorProps {
    simulation: Simulation
    retirementAgePoints: RetirementAgePoints
    onChange: (points: RetirementAgePoints) => void
}

function formatRatio(value: number): string {
    return formatValue(value, {
        numDecimalPlaces: 0,
        numberAbbreviation: false,
    })
}

function formatPercent(value: number): string {
    return formatValue(value, {
        unit: "%",
        numDecimalPlaces: 0,
        numberAbbreviation: false,
    })
}

function getHoverState(
    e: React.PointerEvent<SVGRectElement>,
    xScale: ReturnType<typeof scaleLinear<number>>,
    marginLeft: number,
    innerWidth: number
): HoverState | null {
    const point = localPoint(e)
    if (!point) return null

    const clampedX = Math.max(0, Math.min(point.x - marginLeft, innerWidth))
    const year = Math.max(
        START_YEAR,
        Math.min(END_YEAR, Math.round(xScale.invert(clampedX)))
    )
    return {
        year,
        lineX: xScale(year),
        cursorX: point.x,
        cursorY: point.y,
    }
}

function buildLifeExpectancyPoints(simulation: Simulation): DataPoint[] {
    const config = parameterConfigByKey.lifeExpectancy
    const historical = config.computeHistorical(simulation).points
    const lastHistorical = historical.at(-1)
    if (!lastHistorical) return historical

    const projection = []
    const points = {
        [HISTORICAL_END_YEAR]: lastHistorical.value,
        ...simulation.scenarioParams.lifeExpectancy,
    }
    const controlYears = [HISTORICAL_END_YEAR, ...CONTROL_YEARS]
    for (let year = HISTORICAL_END_YEAR + 1; year <= END_YEAR; year++) {
        projection.push({
            year,
            value: getInterpolatedValue(
                points,
                year,
                HISTORICAL_END_YEAR,
                controlYears
            ),
        })
    }
    return [...historical, ...projection]
}

export function RetirementAgeEditor({
    simulation,
    retirementAgePoints,
    onChange,
}: RetirementAgeEditorProps): React.ReactElement {
    const { parentRef, width, height } = useParentSize()
    return (
        <div
            ref={parentRef}
            className="responsive-container retirement-age-editor"
        >
            {width > 0 && height > 0 && (
                <RetirementAgeEditorContent
                    simulation={simulation}
                    retirementAgePoints={retirementAgePoints}
                    onChange={onChange}
                    width={width}
                    height={height}
                />
            )}
        </div>
    )
}

function RetirementAgeEditorContent({
    simulation,
    retirementAgePoints,
    onChange,
    width,
    height,
}: RetirementAgeEditorProps & {
    width: number
    height: number
}): React.ReactElement {
    const [draggedYear, setDraggedYear] = useState<number | null>(null)
    const [hoverState, setHoverState] = useState<HoverState | null>(null)
    const lifeExpectancyPoints = useMemo(
        () => buildLifeExpectancyPoints(simulation),
        [simulation]
    )
    const retirementAgeLine = useMemo(
        () =>
            FULL_TIME_RANGE.map((year) => ({
                year,
                value: getRetirementAgeForYear(retirementAgePoints, year),
            })),
        [retirementAgePoints]
    )

    const innerWidth =
        width - retirementChartMargin.left - retirementChartMargin.right
    const innerHeight =
        height - retirementChartMargin.top - retirementChartMargin.bottom

    const yMax = Math.max(
        MAX_RETIREMENT_AGE,
        ...lifeExpectancyPoints.map((d) => d.value),
        ...Object.values(retirementAgePoints)
    )
    const yMin = Math.min(
        MIN_RETIREMENT_AGE,
        ...lifeExpectancyPoints.map((d) => d.value),
        ...Object.values(retirementAgePoints)
    )

    const xScale = scaleLinear({
        domain: [START_YEAR, END_YEAR],
        range: [0, innerWidth],
    })
    const yScale = scaleLinear({
        domain: [Math.floor(yMin / 5) * 5, Math.ceil(yMax / 5) * 5],
        range: [innerHeight, 0],
        nice: true,
        clamp: true,
    })

    const updatePointFromPointer = useCallback(
        (e: React.PointerEvent<SVGSVGElement>, year: number) => {
            const point = localPoint(e)
            if (!point) return
            const y = point.y - retirementChartMargin.top
            const value = clampRetirementAge(Math.round(yScale.invert(y)))
            onChange({ ...retirementAgePoints, [year]: value })
        },
        [onChange, retirementAgePoints, yScale]
    )

    const handlePointerMove = useCallback(
        (e: React.PointerEvent<SVGSVGElement>) => {
            if (draggedYear === null) return
            updatePointFromPointer(e, draggedYear)
        },
        [draggedYear, updatePointFromPointer]
    )
    const handleHover = useCallback(
        (e: React.PointerEvent<SVGRectElement>) => {
            setHoverState(
                getHoverState(e, xScale, retirementChartMargin.left, innerWidth)
            )
        },
        [xScale, innerWidth]
    )

    const yTicks = yScale.ticks(3)
    const hoveredRetirementAge = hoverState
        ? (retirementAgeLine.find((d) => d.year === hoverState.year)?.value ??
          0)
        : 0
    const hoveredLifeExpectancy = hoverState
        ? (lifeExpectancyPoints.find((d) => d.year === hoverState.year)
              ?.value ?? 0)
        : 0

    const dismissTooltip = useCallback(() => setHoverState(null), [])
    const { ref: chartRef, isPinned: pinTooltipToBottom } =
        usePinnedTooltip<HTMLDivElement>(hoverState !== null, dismissTooltip)

    return (
        <div
            ref={chartRef}
            style={{
                position: "relative",
                zIndex: hoverState ? 1 : undefined,
            }}
        >
            <svg
                width={width}
                height={height}
                onPointerMove={handlePointerMove}
                onPointerUp={() => setDraggedYear(null)}
                onPointerCancel={() => setDraggedYear(null)}
                onPointerLeave={() => setHoverState(null)}
                overflow="visible"
            >
                <Group
                    top={retirementChartMargin.top}
                    left={retirementChartMargin.left}
                >
                    <rect
                        x={xScale(HISTORICAL_END_YEAR)}
                        y={0}
                        width={innerWidth - xScale(HISTORICAL_END_YEAR)}
                        height={innerHeight}
                        fill={PROJECTION_BACKGROUND}
                    />
                    {yTicks.map((tick) => (
                        <g key={tick}>
                            <line
                                x1={0}
                                x2={innerWidth}
                                y1={yScale(tick)}
                                y2={yScale(tick)}
                                stroke={GRID_LINE_COLOR}
                                strokeDasharray="3,3"
                            />
                            <text
                                x={-6}
                                y={yScale(tick)}
                                textAnchor="end"
                                dominantBaseline="central"
                                fontSize={10}
                                fill={GRID_LABEL_COLOR}
                            >
                                {tick}
                            </text>
                        </g>
                    ))}
                    <LinePath<DataPoint>
                        data={lifeExpectancyPoints}
                        x={(d) => xScale(d.year)}
                        y={(d) => yScale(d.value)}
                        stroke={BENCHMARK_LINE_COLOR}
                        strokeWidth={1.5}
                        strokeDasharray={PROJECTION_DASHARRAY}
                        fill="none"
                    />
                    <LinePath<DataPoint>
                        data={retirementAgeLine}
                        x={(d) => xScale(d.year)}
                        y={(d) => yScale(d.value)}
                        stroke={WORKING_COLOR}
                        strokeWidth={2}
                        fill="none"
                    />
                    <rect
                        x={0}
                        y={0}
                        width={innerWidth}
                        height={innerHeight}
                        fill="transparent"
                        onPointerMove={handleHover}
                        onPointerLeave={() => setHoverState(null)}
                    />
                    {hoverState && (
                        <line
                            x1={hoverState.lineX}
                            x2={hoverState.lineX}
                            y1={0}
                            y2={innerHeight}
                            stroke={GRAPHER_LIGHT_TEXT}
                            strokeWidth={1}
                            strokeDasharray="3,3"
                            opacity={0.6}
                        />
                    )}
                    {CONTROL_YEARS.map((year) => {
                        const value = retirementAgePoints[year]
                        return (
                            <g key={year}>
                                <circle
                                    cx={xScale(year)}
                                    cy={yScale(value)}
                                    r={6}
                                    fill="white"
                                    stroke={WORKING_COLOR}
                                    strokeWidth={2}
                                    style={{ cursor: "ns-resize" }}
                                    onPointerDown={(e) => {
                                        e.currentTarget.setPointerCapture(
                                            e.pointerId
                                        )
                                        setDraggedYear(year)
                                        updatePointFromPointer(e, year)
                                    }}
                                />
                                <text
                                    x={xScale(year)}
                                    y={yScale(value) - 10}
                                    textAnchor="middle"
                                    fontSize={10}
                                    fontWeight={700}
                                    fill={WORKING_COLOR}
                                    style={{ pointerEvents: "none" }}
                                >
                                    {value}
                                </text>
                            </g>
                        )
                    })}
                    <TimeAxisX
                        xScale={xScale}
                        innerWidth={innerWidth}
                        innerHeight={innerHeight}
                        fontSize={10}
                        labelOffset={14}
                        xTickLabels={CONTROL_YEARS.map((year, index) => ({
                            year,
                            position:
                                index === 0
                                    ? "start"
                                    : index === CONTROL_YEARS.length - 1
                                      ? "end"
                                      : "middle",
                        }))}
                    />
                    <ChartLegend
                        items={[
                            { label: "Retirement age", color: WORKING_COLOR },
                            {
                                label: "Life expectancy",
                                color: BENCHMARK_LINE_COLOR,
                                dashArray: PROJECTION_DASHARRAY,
                            },
                        ]}
                        x={0}
                        y={-2}
                    />
                </Group>
            </svg>
            {hoverState && (
                <TooltipCard
                    id="retirement-age-tooltip"
                    x={hoverState.cursorX}
                    y={hoverState.cursorY}
                    offsetX={15}
                    offsetY={-10}
                    title={String(hoverState.year)}
                    anchor={
                        pinTooltipToBottom
                            ? GrapherTooltipAnchor.Bottom
                            : undefined
                    }
                    containerBounds={
                        pinTooltipToBottom
                            ? undefined
                            : { width, height: Math.max(height, 1000) }
                    }
                >
                    <TooltipValue
                        label="Retirement age"
                        value={String(Math.round(hoveredRetirementAge))}
                        color={WORKING_COLOR}
                    />
                    <TooltipValue
                        label="Life expectancy"
                        value={String(Math.round(hoveredLifeExpectancy))}
                        color={BENCHMARK_LINE_COLOR}
                    />
                </TooltipCard>
            )}
        </div>
    )
}

export function RelativeAgeStackedAreaChart({
    simulation,
    retirementAgePoints,
}: {
    simulation: Simulation
    retirementAgePoints: RetirementAgePoints
}): React.ReactElement {
    const { parentRef, width, height } = useParentSize()
    return (
        <div ref={parentRef} className="responsive-container">
            {width > 0 && height > 0 && (
                <RelativeAgeStackedAreaChartContent
                    simulation={simulation}
                    retirementAgePoints={retirementAgePoints}
                    width={width}
                    height={height}
                />
            )}
        </div>
    )
}

function RelativeAgeStackedAreaChartContent({
    simulation,
    retirementAgePoints,
    width,
    height,
}: {
    simulation: Simulation
    retirementAgePoints: RetirementAgePoints
    width: number
    height: number
}): React.ReactElement {
    const [hoverState, setHoverState] = useState<HoverState | null>(null)
    const data = useMemo(
        () =>
            FULL_TIME_RANGE.map((year) => {
                const breakdown = getDependencyBreakdownForYear(
                    simulation,
                    retirementAgePoints,
                    year
                )
                return {
                    year,
                    youngPct: breakdown.youngPct,
                    workingPct: breakdown.workingPct,
                    oldPct: breakdown.oldPct,
                }
            }),
        [simulation, retirementAgePoints]
    )

    const innerWidth =
        width - compactChartMargin.left - compactChartMargin.right
    const innerHeight =
        height - compactChartMargin.top - compactChartMargin.bottom
    const xScale = scaleLinear({
        domain: [START_YEAR, END_YEAR],
        range: [0, innerWidth],
    })
    const yScale = scaleLinear({
        domain: [0, 100],
        range: [innerHeight, 0],
    })

    const youngPath = makeStackedAreaPath(
        data,
        xScale,
        yScale,
        (d) => d.oldPct + d.workingPct,
        (d) => d.oldPct + d.workingPct + d.youngPct
    )
    const workingPath = makeStackedAreaPath(
        data,
        xScale,
        yScale,
        (d) => d.oldPct,
        (d) => d.oldPct + d.workingPct
    )
    const oldPath = makeStackedAreaPath(
        data,
        xScale,
        yScale,
        () => 0,
        (d) => d.oldPct
    )
    const handleHover = useCallback(
        (e: React.PointerEvent<SVGRectElement>) => {
            setHoverState(
                getHoverState(e, xScale, compactChartMargin.left, innerWidth)
            )
        },
        [xScale, innerWidth]
    )
    const hoveredPoint = hoverState
        ? data.find((d) => d.year === hoverState.year)
        : undefined
    const dismissTooltip = useCallback(() => setHoverState(null), [])
    const { ref: chartRef, isPinned: pinTooltipToBottom } =
        usePinnedTooltip<HTMLDivElement>(hoverState !== null, dismissTooltip)

    return (
        <div
            ref={chartRef}
            style={{
                position: "relative",
                zIndex: hoverState ? 1 : undefined,
            }}
        >
            <svg width={width} height={height} overflow="visible">
                <Group
                    top={compactChartMargin.top}
                    left={compactChartMargin.left}
                >
                    <rect
                        x={xScale(HISTORICAL_END_YEAR)}
                        y={0}
                        width={innerWidth - xScale(HISTORICAL_END_YEAR)}
                        height={innerHeight}
                        fill={PROJECTION_BACKGROUND}
                    />
                    {[0, 50, 100].map((tick) => (
                        <g key={tick}>
                            <line
                                x1={0}
                                x2={innerWidth}
                                y1={yScale(tick)}
                                y2={yScale(tick)}
                                stroke={GRID_LINE_COLOR}
                                strokeDasharray="3,3"
                            />
                            <text
                                x={-6}
                                y={yScale(tick)}
                                textAnchor="end"
                                dominantBaseline="central"
                                fontSize={10}
                                fill={GRID_LABEL_COLOR}
                            >
                                {formatPercent(tick)}
                            </text>
                        </g>
                    ))}
                    <path d={oldPath} fill={DEPENDENT_OLD_COLOR} />
                    <path d={workingPath} fill={WORKING_COLOR} />
                    <path d={youngPath} fill={DEPENDENT_YOUNG_COLOR} />
                    <TimeAxisX
                        xScale={xScale}
                        innerWidth={innerWidth}
                        innerHeight={innerHeight}
                        fontSize={10}
                        labelOffset={14}
                    />
                    <ChartLegend
                        items={[
                            {
                                label: `Young (<${WORKING_AGE})`,
                                color: DEPENDENT_YOUNG_COLOR,
                            },
                            { label: "Working age", color: WORKING_COLOR },
                            { label: "Retired", color: DEPENDENT_OLD_COLOR },
                        ]}
                        x={0}
                        y={-2}
                    />
                    <rect
                        x={0}
                        y={0}
                        width={innerWidth}
                        height={innerHeight}
                        fill="transparent"
                        onPointerMove={handleHover}
                        onPointerLeave={() => setHoverState(null)}
                    />
                    {hoverState && (
                        <line
                            x1={hoverState.lineX}
                            x2={hoverState.lineX}
                            y1={0}
                            y2={innerHeight}
                            stroke={GRAPHER_LIGHT_TEXT}
                            strokeWidth={1}
                            strokeDasharray="3,3"
                            opacity={0.6}
                        />
                    )}
                </Group>
            </svg>
            {hoverState && hoveredPoint && (
                <TooltipCard
                    id="age-share-tooltip"
                    x={hoverState.cursorX}
                    y={hoverState.cursorY}
                    offsetX={15}
                    offsetY={-10}
                    title={String(hoverState.year)}
                    anchor={
                        pinTooltipToBottom
                            ? GrapherTooltipAnchor.Bottom
                            : undefined
                    }
                    containerBounds={
                        pinTooltipToBottom
                            ? undefined
                            : { width, height: Math.max(height, 1000) }
                    }
                >
                    <TooltipValue
                        label={`Young (<${WORKING_AGE})`}
                        value={formatPercent(hoveredPoint.youngPct)}
                        color={DEPENDENT_YOUNG_COLOR}
                    />
                    <TooltipValue
                        label="Working age"
                        value={formatPercent(hoveredPoint.workingPct)}
                        color={WORKING_COLOR}
                    />
                    <TooltipValue
                        label="Retired"
                        value={formatPercent(hoveredPoint.oldPct)}
                        color={DEPENDENT_OLD_COLOR}
                    />
                </TooltipCard>
            )}
        </div>
    )
}

export function DependencyRatioLineChart({
    simulation,
    retirementAgePoints,
}: {
    simulation: Simulation
    retirementAgePoints: RetirementAgePoints
}): React.ReactElement {
    const { parentRef, width, height } = useParentSize()
    return (
        <div ref={parentRef} className="responsive-container">
            {width > 0 && height > 0 && (
                <DependencyRatioLineChartContent
                    simulation={simulation}
                    retirementAgePoints={retirementAgePoints}
                    width={width}
                    height={height}
                />
            )}
        </div>
    )
}

function DependencyRatioLineChartContent({
    simulation,
    retirementAgePoints,
    width,
    height,
}: {
    simulation: Simulation
    retirementAgePoints: RetirementAgePoints
    width: number
    height: number
}): React.ReactElement {
    const [hoverState, setHoverState] = useState<HoverState | null>(null)
    const data = useMemo(
        () =>
            FULL_TIME_RANGE.map((year) => ({
                year,
                value: getDependencyBreakdownForYear(
                    simulation,
                    retirementAgePoints,
                    year
                ).dependencyRatio,
            })),
        [simulation, retirementAgePoints]
    )

    const maxValue = Math.max(...data.map((d) => d.value), 100)
    const innerWidth =
        width - compactChartMargin.left - compactChartMargin.right
    const innerHeight =
        height - compactChartMargin.top - compactChartMargin.bottom
    const xScale = scaleLinear({
        domain: [START_YEAR, END_YEAR],
        range: [0, innerWidth],
    })
    const yScale = scaleLinear({
        domain: [0, maxValue * 1.05],
        range: [innerHeight, 0],
        nice: true,
    })
    const handleHover = useCallback(
        (e: React.PointerEvent<SVGRectElement>) => {
            setHoverState(
                getHoverState(e, xScale, compactChartMargin.left, innerWidth)
            )
        },
        [xScale, innerWidth]
    )
    const hoveredPoint = hoverState
        ? data.find((d) => d.year === hoverState.year)
        : undefined
    const dismissTooltip = useCallback(() => setHoverState(null), [])
    const { ref: chartRef, isPinned: pinTooltipToBottom } =
        usePinnedTooltip<HTMLDivElement>(hoverState !== null, dismissTooltip)

    return (
        <div
            ref={chartRef}
            style={{
                position: "relative",
                zIndex: hoverState ? 1 : undefined,
            }}
        >
            <svg width={width} height={height} overflow="visible">
                <Group
                    top={compactChartMargin.top}
                    left={compactChartMargin.left}
                >
                    <rect
                        x={xScale(HISTORICAL_END_YEAR)}
                        y={0}
                        width={innerWidth - xScale(HISTORICAL_END_YEAR)}
                        height={innerHeight}
                        fill={PROJECTION_BACKGROUND}
                    />
                    {yScale.ticks(3).map((tick) => (
                        <g key={tick}>
                            <line
                                x1={0}
                                x2={innerWidth}
                                y1={yScale(tick)}
                                y2={yScale(tick)}
                                stroke={GRID_LINE_COLOR}
                                strokeDasharray="3,3"
                            />
                            <text
                                x={-6}
                                y={yScale(tick)}
                                textAnchor="end"
                                dominantBaseline="central"
                                fontSize={10}
                                fill={GRID_LABEL_COLOR}
                            >
                                {formatRatio(tick)}
                            </text>
                        </g>
                    ))}
                    <LinePath<DataPoint>
                        data={data}
                        x={(d) => xScale(d.year)}
                        y={(d) => yScale(d.value)}
                        stroke={DEPENDENT_OLD_COLOR}
                        strokeWidth={2}
                        fill="none"
                    />
                    <TimeAxisX
                        xScale={xScale}
                        innerWidth={innerWidth}
                        innerHeight={innerHeight}
                        fontSize={10}
                        labelOffset={14}
                    />
                    <rect
                        x={0}
                        y={0}
                        width={innerWidth}
                        height={innerHeight}
                        fill="transparent"
                        onPointerMove={handleHover}
                        onPointerLeave={() => setHoverState(null)}
                    />
                    {hoverState && hoveredPoint && (
                        <>
                            <line
                                x1={hoverState.lineX}
                                x2={hoverState.lineX}
                                y1={0}
                                y2={innerHeight}
                                stroke={GRAPHER_LIGHT_TEXT}
                                strokeWidth={1}
                                strokeDasharray="3,3"
                                opacity={0.6}
                            />
                            <circle
                                cx={hoverState.lineX}
                                cy={yScale(hoveredPoint.value)}
                                r={3}
                                fill="white"
                                stroke={DEPENDENT_OLD_COLOR}
                                strokeWidth={2}
                            />
                        </>
                    )}
                </Group>
            </svg>
            {hoverState && hoveredPoint && (
                <TooltipCard
                    id="dependency-ratio-tooltip"
                    x={hoverState.cursorX}
                    y={hoverState.cursorY}
                    offsetX={15}
                    offsetY={-10}
                    title={String(hoverState.year)}
                    anchor={
                        pinTooltipToBottom
                            ? GrapherTooltipAnchor.Bottom
                            : undefined
                    }
                    containerBounds={
                        pinTooltipToBottom
                            ? undefined
                            : { width, height: Math.max(height, 1000) }
                    }
                >
                    <TooltipValue
                        label="Dependency ratio"
                        value={`${formatRatio(hoveredPoint.value)} per 100`}
                        color={DEPENDENT_OLD_COLOR}
                    />
                </TooltipCard>
            )}
        </div>
    )
}

export function DependencyRatioPyramidBar({
    simulation,
    retirementAgePoints,
    year,
}: {
    simulation: Simulation
    retirementAgePoints: RetirementAgePoints
    year: number
}): React.ReactElement {
    const { parentRef, width, height } = useParentSize()
    const breakdown = useMemo(
        () =>
            getDependencyBreakdownForYear(
                simulation,
                retirementAgePoints,
                year
            ),
        [simulation, retirementAgePoints, year]
    )

    return (
        <div ref={parentRef} className="dependency-ratio-pyramid-bar">
            {width > 0 && height > 0 && (
                <DependencyRatioPyramidBarContent
                    breakdown={breakdown}
                    width={width}
                    height={height}
                />
            )}
        </div>
    )
}

function DependencyRatioPyramidBarContent({
    breakdown,
    width,
    height,
}: {
    breakdown: DependencyAgeBreakdown
    width: number
    height: number
}): React.ReactElement | null {
    if (breakdown.total <= 0) return null

    const segments = [
        {
            key: "young",
            label: "Young",
            value: breakdown.young,
            color: DEPENDENT_YOUNG_COLOR,
        },
        {
            key: "working",
            label: "Working",
            value: breakdown.working,
            color: WORKING_COLOR,
        },
        {
            key: "old",
            label: "Retired",
            value: breakdown.old,
            color: DEPENDENT_OLD_COLOR,
        },
    ]
    let x = 0
    const label = `${formatRatio(breakdown.dependencyRatio)} dependents per 100 working-age people`

    return (
        <svg width={width} height={height} overflow="visible">
            <text
                x={0}
                y={11}
                fontSize={11}
                fill={GRAPHER_DARK_TEXT}
                fontWeight={600}
            >
                {label}
            </text>
            <g transform="translate(0,18)">
                {segments.map((segment) => {
                    const segmentWidth =
                        (segment.value / breakdown.total) * width
                    const currentX = x
                    x += segmentWidth
                    return (
                        <rect
                            key={segment.key}
                            x={currentX}
                            y={0}
                            width={segmentWidth}
                            height={10}
                            fill={segment.color}
                        />
                    )
                })}
            </g>
        </svg>
    )
}

function ChartLegend({
    items,
    x,
    y,
}: {
    items: { label: string; color: string; dashArray?: string }[]
    x: number
    y: number
}): React.ReactElement {
    let offsetX = x
    return (
        <g transform={`translate(${x},${y})`}>
            {items.map((item) => {
                const itemX = offsetX - x
                offsetX += item.label.length * 6 + 28
                return (
                    <g key={item.label} transform={`translate(${itemX},0)`}>
                        <line
                            x1={0}
                            x2={14}
                            y1={0}
                            y2={0}
                            stroke={item.color}
                            strokeWidth={3}
                            strokeDasharray={item.dashArray}
                        />
                        <text
                            x={18}
                            y={0}
                            dominantBaseline="central"
                            fontSize={10}
                            fill={GRAPHER_LIGHT_TEXT}
                        >
                            {item.label}
                        </text>
                    </g>
                )
            })}
        </g>
    )
}

function makeStackedAreaPath(
    data: AgeShareDataPoint[],
    xScale: (value: number) => number,
    yScale: (value: number) => number,
    y0: (d: AgeShareDataPoint) => number,
    y1: (d: AgeShareDataPoint) => number
): string {
    if (data.length === 0) return ""

    const top = data.map((d) => `${xScale(d.year)},${yScale(y1(d))}`)
    const bottom = [...data]
        .reverse()
        .map((d) => `${xScale(d.year)},${yScale(y0(d))}`)

    return `M${top.join("L")}L${bottom.join("L")}Z`
}
