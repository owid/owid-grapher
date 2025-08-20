import React from "react"
import { makeIdForHumanConsumption } from "@ourworldindata/utils"
import {
    BLUR_FILL_OPACITY,
    BLUR_STROKE_OPACITY,
    ChoroplethSeries,
    DEFAULT_STROKE_COLOR,
    DEFAULT_STROKE_WIDTH,
    HOVER_STROKE_COLOR,
    HOVER_STROKE_WIDTH,
    PATTERN_STROKE_WIDTH,
    SELECTED_STROKE_WIDTH,
    SVGMouseEvent,
    RenderFeature,
    InternalAnnotation,
    ExternalAnnotation,
} from "./MapChartConstants"
import { isMapRenderFeature } from "./MapHelpers"
import { getExternalMarkerEndPosition } from "./MapAnnotations"
import { Patterns } from "../core/GrapherConstants"
import { calculateLightnessScore, isDarkColor } from "../color/ColorUtils"
import { Halo } from "@ourworldindata/components"
import { InteractionState } from "../interaction/InteractionState"

export function BackgroundCountry<Feature extends RenderFeature>({
    feature,
    path,
    strokeWidth = DEFAULT_STROKE_WIDTH,
}: {
    feature: Feature
    path?: string
    strokeWidth?: number
}): React.ReactElement {
    return (
        <path
            id={makeIdForHumanConsumption(feature.id)}
            d={isMapRenderFeature(feature) ? feature.path : path}
            strokeWidth={strokeWidth}
            stroke="#aaa"
            fill="#fff"
        />
    )
}

export function CountryWithData<Feature extends RenderFeature>({
    feature,
    series,
    path,
    isSelected = false,
    hover,
    strokeScale = 1,
    onClick,
    onTouchStart,
    onMouseEnter,
    onMouseLeave,
}: {
    feature: Feature
    series: ChoroplethSeries
    path?: string
    isSelected?: boolean
    hover?: InteractionState
    strokeScale?: number
    onClick?: (event: SVGMouseEvent) => void
    onTouchStart?: (event: React.TouchEvent<SVGElement>) => void
    onMouseEnter?: (feature: Feature, event: MouseEvent) => void
    onMouseLeave?: () => void
}): React.ReactElement {
    const isProjection = series.isProjection
    const isHovered = hover?.active ?? false

    const stroke =
        isHovered || isSelected ? HOVER_STROKE_COLOR : DEFAULT_STROKE_COLOR
    const strokeWidth = getStrokeWidth({ isHovered, isSelected }) / strokeScale
    const strokeOpacity = hover?.background ? BLUR_STROKE_OPACITY : 1

    const fill = isProjection
        ? `url(#${makeProjectedDataPatternId(series.color)})`
        : series.color
    const fillOpacity = hover?.background ? BLUR_FILL_OPACITY : 1

    return (
        <path
            id={makeIdForHumanConsumption(feature.id)}
            data-feature-id={feature.id}
            d={isMapRenderFeature(feature) ? feature.path : path}
            strokeWidth={strokeWidth}
            stroke={stroke}
            strokeOpacity={strokeOpacity}
            cursor="pointer"
            fill={fill}
            fillOpacity={fillOpacity}
            onClick={onClick}
            onTouchStart={onTouchStart}
            onMouseEnter={(event): void =>
                onMouseEnter?.(feature, event.nativeEvent)
            }
            onMouseLeave={onMouseLeave}
        />
    )
}

export function CountryWithNoData<Feature extends RenderFeature>({
    feature,
    path,
    patternId,
    isSelected = false,
    hover,
    strokeScale = 1,
    onClick,
    onTouchStart,
    onMouseEnter,
    onMouseLeave,
}: {
    feature: Feature
    path?: string
    patternId: string
    isSelected?: boolean
    hover?: InteractionState
    strokeScale?: number
    onClick?: (event: SVGMouseEvent) => void
    onTouchStart?: (event: React.TouchEvent<SVGElement>) => void
    onMouseEnter?: (feature: Feature, event: MouseEvent) => void
    onMouseLeave?: () => void
}): React.ReactElement {
    const isHovered = hover?.active ?? false

    const stroke = isHovered || isSelected ? HOVER_STROKE_COLOR : "#aaa"
    const strokeWidth = getStrokeWidth({ isHovered, isSelected }) / strokeScale
    const strokeOpacity = hover?.background ? BLUR_STROKE_OPACITY : 1

    const fillOpacity = hover?.background ? BLUR_FILL_OPACITY : 1

    return (
        <path
            id={makeIdForHumanConsumption(feature.id)}
            data-feature-id={feature.id}
            d={isMapRenderFeature(feature) ? feature.path : path}
            strokeWidth={strokeWidth}
            stroke={stroke}
            strokeOpacity={strokeOpacity}
            cursor="pointer"
            fill={`url(#${patternId})`}
            fillOpacity={fillOpacity}
            onClick={onClick}
            onTouchStart={onTouchStart}
            onMouseEnter={(event): void =>
                onMouseEnter?.(feature, event.nativeEvent)
            }
            onMouseLeave={onMouseLeave}
        />
    )
}

export function NoDataPattern({
    patternId,
    scale = 1,
}: {
    patternId: string
    scale?: number
}): React.ReactElement {
    return (
        <pattern
            id={patternId}
            patternUnits="userSpaceOnUse"
            width="4"
            height="4"
            patternTransform={`rotate(-45 2 2) scale(${scale})`}
        >
            <path
                d="M -1,2 l 6,0"
                stroke="#ccc"
                strokeWidth={PATTERN_STROKE_WIDTH}
            />
        </pattern>
    )
}

export function ProjectedDataPattern({
    color,
    scale = 1,
    forLegend = false,
}: {
    color: string
    scale?: number
    forLegend?: boolean
}): React.ReactElement {
    return (
        <DottedProjectedDataPattern
            patternId={makeProjectedDataPatternId(color, { forLegend })}
            color={color}
            scale={scale}
            dotOpacity={forLegend ? 0.2 : undefined}
        />
    )
}

function DottedProjectedDataPattern({
    patternId,
    color,
    scale = 1,
    patternSize = 4,
    dotSize = patternSize / 4,
    dotOpacity,
}: {
    patternId: string
    color: string
    scale?: number
    patternSize?: number
    dotSize?: number
    dotOpacity?: number // inferred from color lightness if not provided
}): React.ReactElement {
    // Choose the dot opacity based on the lightness of the color:
    // - If the color is light, make the dots more transparent
    // - If the color is dark, make the dots more opaque
    const lightness = calculateLightnessScore(color) ?? 0
    const opacity = dotOpacity ?? Math.max(1 - lightness, 0.1)

    return (
        <pattern
            id={patternId}
            patternUnits="userSpaceOnUse"
            width={patternSize}
            height={patternSize}
            patternTransform={`rotate(45) scale(${scale})`}
        >
            {/* colored background */}
            <rect width={patternSize} height={patternSize} fill={color} />

            {/* dots */}
            <circle
                cx={patternSize / 2}
                cy={patternSize / 2}
                r={dotSize}
                fill="black"
                fillOpacity={opacity}
            />
        </pattern>
    )
}

export function InternalValueAnnotation({
    annotation,
    strokeScale = 1,
    showOutline = false,
}: {
    annotation: InternalAnnotation
    strokeScale?: number
    showOutline?: boolean
}): React.ReactElement {
    const { id, text, color, placedBounds, fontSize } = annotation

    const showHalo = showOutline && isDarkColor(color)

    return (
        <Halo id={id} outlineWidth={3} show={showHalo}>
            <text
                id={makeIdForHumanConsumption(id)}
                x={placedBounds.topLeft.x}
                y={placedBounds.topLeft.y + placedBounds.height - 1}
                fontSize={fontSize}
                fontWeight={700}
                fill={color}
                strokeWidth={DEFAULT_STROKE_WIDTH / strokeScale}
                style={{ pointerEvents: "none" }}
            >
                {text}
            </text>
        </Halo>
    )
}

export function ExternalValueAnnotation({
    annotation,
    strokeScale = 1,
    onMouseEnter,
    onMouseLeave,
}: {
    annotation: ExternalAnnotation
    strokeScale?: number
    onMouseEnter?: (feature: RenderFeature) => void
    onMouseLeave?: () => void
}): React.ReactElement {
    const { id, text, direction, anchor, placedBounds, fontSize } = annotation

    const markerStart = anchor
    const markerEnd = getExternalMarkerEndPosition({
        textBounds: placedBounds,
        direction,
    })

    return (
        <g id={makeIdForHumanConsumption(id)}>
            <line
                x1={markerStart[0]}
                y1={markerStart[1]}
                x2={markerEnd[0]}
                y2={markerEnd[1]}
                stroke={annotation.color}
                strokeWidth={(0.5 * HOVER_STROKE_WIDTH) / strokeScale}
                style={{ pointerEvents: "none" }}
            />
            <text
                x={placedBounds.x}
                y={placedBounds.y + placedBounds.height - 1}
                fontSize={fontSize}
                strokeWidth={DEFAULT_STROKE_WIDTH / strokeScale}
                fill={annotation.color}
                fontWeight={700}
                onMouseEnter={() => onMouseEnter?.(annotation.feature)}
                onMouseLeave={onMouseLeave}
            >
                {text}
            </text>
        </g>
    )
}

function getStrokeWidth({
    isSelected,
    isHovered,
}: {
    isSelected: boolean
    isHovered: boolean
}): number {
    if (isHovered) return HOVER_STROKE_WIDTH
    if (isSelected) return SELECTED_STROKE_WIDTH
    return DEFAULT_STROKE_WIDTH
}

export function makeProjectedDataPatternId(
    color: string,
    options?: { forLegend: boolean }
): string {
    const prefix = options?.forLegend
        ? Patterns.projectedDataPatternForLegend
        : Patterns.projectedDataPattern
    return `${prefix}_${color}`
}
