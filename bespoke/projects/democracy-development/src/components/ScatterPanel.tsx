import { useCallback, useMemo, useRef } from "react"
import cx from "clsx"

import { getRelativeMouse, isTouchDevice } from "@ourworldindata/utils"
import {
    GRAPHER_LIGHT_TEXT,
    GRAY_10,
    GRAY_20,
    GRAY_30,
    GRAY_60,
    GRAY_90,
} from "@ourworldindata/grapher/src/color/ColorConstants.js"

import {
    findEmptyCornerTriangle,
    getTriangleVertices,
} from "../core/emptyCornerTriangle.js"
import { getPanelAxes, type AxisDef, type PixelScale } from "../core/layout.js"
import type {
    AxisRange,
    DemocracyAxis,
    HoverState,
    IndicatorSpec,
    ScatterPoint,
} from "../core/types.js"
import { ScatterTooltip } from "./ScatterTooltip.js"

const MARGIN = { top: 10, right: 12, bottom: 28, left: 44 }
const TICK_FONT_SIZE = 11
/** How far from a dot's edge the pointer may be and still pick it up */
const HOVER_SLACK = 10
const DIMMED_COLOR = GRAY_30

export interface PanelProps {
    spec: IndicatorSpec
    range: AxisRange
    points: ScatterPoint[]
    year: number
    width: number
    plotHeight: number
    democracyAxis: DemocracyAxis
    getColor: (point: ScatterPoint) => string
    getRadius: (point: ScatterPoint) => number
    showPopulation: boolean
    showTriangle: boolean
    hover: HoverState | undefined
    isPinned: boolean
    onHover: (hover: HoverState | undefined) => void
}

export function ScatterPanel({
    spec,
    range,
    points,
    year,
    width,
    plotHeight,
    democracyAxis,
    getColor,
    getRadius,
    showPopulation,
    showTriangle,
    hover,
    isPinned,
    onHover,
}: PanelProps): React.ReactElement {
    const svgRef = useRef<SVGSVGElement>(null)
    const plotWidth = Math.max(width - MARGIN.left - MARGIN.right, 0)
    const svgHeight = plotHeight + MARGIN.top + MARGIN.bottom

    const axes = useMemo(
        () =>
            getPanelAxes({ spec, range, democracyAxis, plotWidth, plotHeight }),
        [spec, range, democracyAxis, plotWidth, plotHeight]
    )

    // Pixel positions, largest dots first so small ones stay clickable on top
    const placed = useMemo(
        () =>
            points
                .map((point) => ({
                    point,
                    cx: axes.xScale(axes.getX(point)),
                    cy: axes.yScale(axes.getY(point)),
                    r: getRadius(point),
                }))
                .sort((a, b) => b.r - a.r),
        [points, axes, getRadius]
    )

    const triangle = useMemo(() => {
        if (!showTriangle || plotWidth === 0 || plotHeight === 0)
            return undefined
        const normalized = placed.map(({ cx, cy }) => ({
            u: cx / plotWidth,
            v: cy / plotHeight,
        }))
        const maxRadius = Math.max(0, ...placed.map((d) => d.r))
        return findEmptyCornerTriangle(normalized, axes.emptyCorner, {
            margin: maxRadius / Math.min(plotWidth, plotHeight),
        })
    }, [placed, axes.emptyCorner, plotWidth, plotHeight, showTriangle])

    const hoveredEntity = hover?.entityName
    const hoveredPlaced = hoveredEntity
        ? placed.find((d) => d.point.entityName === hoveredEntity)
        : undefined
    const isThisPanelHovered = hover?.panelKey === spec.key

    const handlePointerMove = useCallback(
        (event: React.PointerEvent<SVGSVGElement>) => {
            if (!svgRef.current) return
            const mouse = getRelativeMouse(svgRef.current, event.nativeEvent)
            const x = mouse.x - MARGIN.left
            const y = mouse.y - MARGIN.top
            let nearest: (typeof placed)[number] | undefined
            let nearestDistance = Infinity
            for (const d of placed) {
                const distance = Math.hypot(d.cx - x, d.cy - y) - d.r
                if (distance < nearestDistance) {
                    nearestDistance = distance
                    nearest = d
                }
            }
            if (nearest && nearestDistance <= HOVER_SLACK) {
                onHover({
                    entityName: nearest.point.entityName,
                    panelKey: spec.key,
                    position: { x: mouse.x, y: mouse.y },
                })
            } else if (!isPinned) {
                onHover(undefined)
            }
        },
        [placed, onHover, spec.key, isPinned]
    )

    const handlePointerLeave = useCallback(() => {
        // On touch devices usePinnedTooltip owns dismissal
        if (isTouchDevice()) return
        onHover(undefined)
    }, [onHover])

    return (
        <div className="democracy-panel" style={{ width }}>
            <header className="democracy-panel__header">
                <h2 className="democracy-panel__title">{spec.title}</h2>
                <p className="democracy-panel__subtitle">{spec.subtitle}</p>
            </header>
            <div className="democracy-panel__plot">
                <svg
                    ref={svgRef}
                    className="democracy-panel__svg"
                    width={width}
                    height={svgHeight}
                    viewBox={`0 0 ${width} ${svgHeight}`}
                    onPointerMove={handlePointerMove}
                    onPointerLeave={handlePointerLeave}
                    onPointerDown={handlePointerMove}
                >
                    <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
                        {triangle && (
                            <polygon
                                className="democracy-panel__empty-corner"
                                points={getTriangleVertices(triangle)
                                    .map(
                                        ({ u, v }) =>
                                            `${u * plotWidth},${v * plotHeight}`
                                    )
                                    .join(" ")}
                                fill={GRAY_10}
                            />
                        )}
                        <Gridlines
                            axis={axes.y}
                            scale={axes.yScale}
                            length={plotWidth}
                            orientation="horizontal"
                        />
                        <Gridlines
                            axis={axes.x}
                            scale={axes.xScale}
                            length={plotHeight}
                            orientation="vertical"
                        />
                        <AxisX
                            axis={axes.x}
                            scale={axes.xScale}
                            plotWidth={plotWidth}
                            plotHeight={plotHeight}
                        />
                        <AxisY axis={axes.y} scale={axes.yScale} />
                        <g className="democracy-panel__dots">
                            {placed.map(({ point, cx, cy, r }) => {
                                const isHovered =
                                    point.entityName === hoveredEntity
                                const isDimmed = !!hoveredEntity && !isHovered
                                return (
                                    <circle
                                        key={point.entityName}
                                        cx={cx}
                                        cy={cy}
                                        r={r}
                                        fill={
                                            isDimmed
                                                ? DIMMED_COLOR
                                                : getColor(point)
                                        }
                                        fillOpacity={
                                            showPopulation && !isDimmed
                                                ? 0.75
                                                : 1
                                        }
                                        stroke={isHovered ? GRAY_90 : "#fff"}
                                        strokeWidth={isHovered ? 1.5 : 0.5}
                                    />
                                )
                            })}
                        </g>
                        {hoveredPlaced && (
                            <HoverLabel
                                x={hoveredPlaced.cx}
                                y={hoveredPlaced.cy}
                                r={hoveredPlaced.r}
                                text={hoveredPlaced.point.entityName}
                                plotWidth={plotWidth}
                            />
                        )}
                    </g>
                </svg>
                {hover && isThisPanelHovered && hoveredPlaced && (
                    <ScatterTooltip
                        hover={hover}
                        point={hoveredPlaced.point}
                        spec={spec}
                        year={year}
                        color={getColor(hoveredPlaced.point)}
                        showPopulation={showPopulation}
                        isPinned={isPinned}
                        containerBounds={{ width, height: svgHeight }}
                    />
                )}
            </div>
        </div>
    )
}

function Gridlines({
    axis,
    scale,
    length,
    orientation,
}: {
    axis: AxisDef
    scale: PixelScale
    length: number
    orientation: "horizontal" | "vertical"
}): React.ReactElement {
    return (
        <g className="democracy-panel__gridlines">
            {axis.ticks.map((tick) => {
                const position = scale(tick)
                return orientation === "horizontal" ? (
                    <line
                        key={tick}
                        x1={0}
                        x2={length}
                        y1={position}
                        y2={position}
                        stroke={GRAY_20}
                    />
                ) : (
                    <line
                        key={tick}
                        x1={position}
                        x2={position}
                        y1={0}
                        y2={length}
                        stroke={GRAY_20}
                    />
                )
            })}
        </g>
    )
}

function AxisX({
    axis,
    scale,
    plotWidth,
    plotHeight,
}: {
    axis: AxisDef
    scale: PixelScale
    plotWidth: number
    plotHeight: number
}): React.ReactElement {
    return (
        <g
            className="democracy-panel__axis"
            transform={`translate(0,${plotHeight})`}
        >
            <line x1={0} x2={plotWidth} y1={0} y2={0} stroke={GRAY_60} />
            {axis.ticks.map((tick, i) => {
                const x = scale(tick)
                const isFirst = i === 0
                const isLast = i === axis.ticks.length - 1
                return (
                    <text
                        key={tick}
                        x={x}
                        y={TICK_FONT_SIZE + 6}
                        fontSize={TICK_FONT_SIZE}
                        fill={GRAPHER_LIGHT_TEXT}
                        textAnchor={
                            isFirst ? "start" : isLast ? "end" : "middle"
                        }
                    >
                        {axis.formatTick(tick)}
                    </text>
                )
            })}
        </g>
    )
}

function AxisY({
    axis,
    scale,
}: {
    axis: AxisDef
    scale: PixelScale
}): React.ReactElement {
    return (
        <g className="democracy-panel__axis">
            {axis.ticks.map((tick, i) => {
                const y = scale(tick)
                const isTop = i === axis.ticks.length - 1
                return (
                    <text
                        key={tick}
                        x={-8}
                        y={y}
                        dy={isTop ? "0.9em" : "0.32em"}
                        fontSize={TICK_FONT_SIZE}
                        fill={GRAPHER_LIGHT_TEXT}
                        textAnchor="end"
                    >
                        {axis.formatTick(tick)}
                    </text>
                )
            })}
        </g>
    )
}

/** The hovered country's name next to its dot, flipped left near the right edge */
function HoverLabel({
    x,
    y,
    r,
    text,
    plotWidth,
}: {
    x: number
    y: number
    r: number
    text: string
    plotWidth: number
}): React.ReactElement {
    const approxWidth = text.length * 6.5
    const flip = x + r + 6 + approxWidth > plotWidth
    return (
        <text
            className={cx("democracy-panel__hover-label")}
            x={flip ? x - r - 6 : x + r + 6}
            y={y}
            dy="0.35em"
            fontSize={12}
            fontWeight={700}
            fill={GRAY_90}
            textAnchor={flip ? "end" : "start"}
            stroke="#fff"
            strokeWidth={3}
            paintOrder="stroke"
        >
            {text}
        </text>
    )
}
