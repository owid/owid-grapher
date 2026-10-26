import React from "react"
import { Color } from "@ourworldindata/types"
import { makeFigmaId, roundForSvg } from "@ourworldindata/utils"
import {
    BLUR_FILL_OPACITY,
    BLUR_STROKE_OPACITY,
    ChoroplethSeries,
    DEFAULT_STROKE_COLOR,
    DEFAULT_STROKE_WIDTH,
    HOVER_STROKE_COLOR,
    HOVER_STROKE_WIDTH,
    SELECTED_STROKE_WIDTH,
    SVGMouseEvent,
    RenderFeature,
    InternalAnnotation,
    ExternalAnnotation,
} from "./MapChartConstants"
import { isMapRenderFeature } from "./MapHelpers"
import { getExternalMarkerEndPosition } from "./MapAnnotations"
import { Patterns, makePatternId } from "../core/GrapherConstants"
import { calculateLightnessScore, isDarkColor } from "../color/ColorUtils"
import { INAPPLICABLE_COLOR } from "../color/ColorScale"
import { Halo } from "@ourworldindata/components"
import { InteractionState } from "../interaction/InteractionState"

import * as R from "remeda"

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
            id={makeFigmaId(feature.id)}
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
    patternIdSuffix,
    path,
    isSelected = false,
    hover,
    strokeScale = 1,
    onClick,
    onPointerEnter,
    onPointerLeave,
}: {
    feature: Feature
    series: ChoroplethSeries
    patternIdSuffix?: string
    path?: string
    isSelected?: boolean
    hover?: InteractionState
    strokeScale?: number
    onClick?: (feature: Feature, event: SVGMouseEvent) => void
    onPointerEnter?: (feature: Feature, event: PointerEvent) => void
    onPointerLeave?: (event: PointerEvent) => void
}): React.ReactElement {
    const isProjection = series.isProjection
    const isHovered = hover?.active ?? false

    const stroke =
        isHovered || isSelected ? HOVER_STROKE_COLOR : DEFAULT_STROKE_COLOR
    const strokeWidth = scaleStrokeWidth(
        getStrokeWidth({ isHovered, isSelected }),
        strokeScale
    )
    const strokeOpacity = hover?.background ? BLUR_STROKE_OPACITY : 1

    const fillOpacity = hover?.background ? BLUR_FILL_OPACITY : 1
    const featurePath = isMapRenderFeature(feature) ? feature.path : path

    return (
        <>
            <path
                id={makeFigmaId(feature.id)}
                data-feature-id={feature.id}
                d={featurePath}
                strokeWidth={strokeWidth}
                stroke={stroke}
                strokeOpacity={strokeOpacity}
                cursor="pointer"
                fill={series.color}
                fillOpacity={fillOpacity}
                onClick={(event) => onClick?.(feature, event)}
                onPointerEnter={(e) => onPointerEnter?.(feature, e.nativeEvent)}
                onPointerLeave={(e) => onPointerLeave?.(e.nativeEvent)}
            />
            {isProjection && (
                <path
                    id={makeFigmaId(feature.id, "projected-data-pattern")}
                    d={featurePath}
                    stroke="none"
                    fill={`url(#${makeProjectedDataPatternId(series.color, patternIdSuffix)})`}
                    fillOpacity={fillOpacity}
                    pointerEvents="none"
                />
            )}
        </>
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
    onPointerEnter,
    onPointerLeave,
}: {
    feature: Feature
    path?: string
    patternId: string
    isSelected?: boolean
    hover?: InteractionState
    strokeScale?: number
    onClick?: (feature: Feature, event: SVGMouseEvent) => void
    onPointerEnter?: (feature: Feature, event: PointerEvent) => void
    onPointerLeave?: (event: PointerEvent) => void
}): React.ReactElement {
    const isHovered = hover?.active ?? false

    const stroke = isHovered || isSelected ? HOVER_STROKE_COLOR : "#aaa"
    const strokeWidth = scaleStrokeWidth(
        getStrokeWidth({ isHovered, isSelected }),
        strokeScale
    )
    const strokeOpacity = hover?.background ? BLUR_STROKE_OPACITY : 1

    const fillOpacity = hover?.background ? BLUR_FILL_OPACITY : 1

    return (
        <path
            id={makeFigmaId(feature.id)}
            data-feature-id={feature.id}
            d={isMapRenderFeature(feature) ? feature.path : path}
            strokeWidth={strokeWidth}
            stroke={stroke}
            strokeOpacity={strokeOpacity}
            cursor="pointer"
            fill={`url(#${patternId})`}
            fillOpacity={fillOpacity}
            onClick={(event) => onClick?.(feature, event)}
            onPointerEnter={(e) => onPointerEnter?.(feature, e.nativeEvent)}
            onPointerLeave={(e) => onPointerLeave?.(e.nativeEvent)}
        />
    )
}

export function InapplicablePattern({
    patternId = Patterns.inapplicablePattern,
    color = INAPPLICABLE_COLOR,
    scale = 1,
}: {
    patternId?: string
    color?: Color
    scale?: number
}): React.ReactElement {
    const roundedScale = R.round(scale, 3)
    return (
        <pattern
            id={patternId}
            patternUnits="userSpaceOnUse"
            width="4"
            height="4"
            patternTransform={`rotate(-45 2 2) scale(${roundedScale})`}
        >
            <rect width="4" height="4" fill={color} />
            <path d="M -1,2 l 6,0" stroke="#fff" strokeWidth={0.7} />
        </pattern>
    )
}

export function ProjectedDataPattern({
    color,
    scale = 1,
    idSuffix,
}: {
    color: string
    scale?: number
    idSuffix?: string
}): React.ReactElement {
    const lightness = calculateLightnessScore(color) ?? 0
    return (
        <DottedProjectedDataPattern
            patternId={makeProjectedDataPatternId(color, idSuffix)}
            scale={scale}
            dotOpacity={Math.max(1 - lightness, 0.1)}
        />
    )
}

export function ProjectedDataLegendPattern({
    scale = 1,
    idSuffix,
}: {
    scale?: number
    idSuffix?: string
}): React.ReactElement {
    return (
        <DottedProjectedDataPattern
            patternId={makeProjectedDataLegendPatternId(idSuffix)}
            scale={scale}
            dotOpacity={0.2}
        />
    )
}

function DottedProjectedDataPattern({
    patternId,
    dotOpacity,
    scale = 1,
    patternSize = 4,
    dotSize = patternSize / 4,
}: {
    patternId: string
    dotOpacity: number
    scale?: number
    patternSize?: number
    dotSize?: number
}): React.ReactElement {
    const roundedScale = R.round(scale, 3)

    return (
        <pattern
            id={patternId}
            patternUnits="userSpaceOnUse"
            width={roundForSvg(patternSize)}
            height={roundForSvg(patternSize)}
            patternTransform={`rotate(45) scale(${roundedScale})`}
        >
            <circle
                cx={roundForSvg(patternSize / 2)}
                cy={roundForSvg(patternSize / 2)}
                r={roundForSvg(dotSize)}
                fill="black"
                fillOpacity={dotOpacity}
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
    const strokeWidth = scaleStrokeWidth(DEFAULT_STROKE_WIDTH, strokeScale)

    return (
        <Halo id={id} outlineWidth={3} show={showHalo}>
            <text
                id={makeFigmaId(id)}
                x={roundForSvg(placedBounds.topLeft.x)}
                y={roundForSvg(
                    placedBounds.topLeft.y + placedBounds.height - 1
                )}
                fontSize={fontSize}
                fontWeight={700}
                fill={color}
                strokeWidth={strokeWidth}
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
    onPointerEnter,
    onPointerLeave,
}: {
    annotation: ExternalAnnotation
    strokeScale?: number
    onPointerEnter?: (feature: RenderFeature, event: PointerEvent) => void
    onPointerLeave?: (event: PointerEvent) => void
}): React.ReactElement {
    const { id, text, direction, anchor, placedBounds, fontSize } = annotation

    const markerStart = anchor
    const markerEnd = getExternalMarkerEndPosition({
        textBounds: placedBounds,
        direction,
    })
    const lineStrokeWidth = R.round((0.5 * HOVER_STROKE_WIDTH) / strokeScale, 3)
    const textStrokeWidth = R.round(DEFAULT_STROKE_WIDTH / strokeScale, 3)

    return (
        <g id={makeFigmaId(id)}>
            <line
                x1={roundForSvg(markerStart[0])}
                y1={roundForSvg(markerStart[1])}
                x2={roundForSvg(markerEnd[0])}
                y2={roundForSvg(markerEnd[1])}
                stroke={annotation.color}
                strokeWidth={lineStrokeWidth}
                style={{ pointerEvents: "none" }}
            />
            <text
                x={roundForSvg(placedBounds.x)}
                y={roundForSvg(placedBounds.y + placedBounds.height - 1)}
                fontSize={fontSize}
                strokeWidth={textStrokeWidth}
                fill={annotation.color}
                fontWeight={700}
                onPointerEnter={(e) =>
                    onPointerEnter?.(annotation.feature, e.nativeEvent)
                }
                onPointerLeave={(e) => onPointerLeave?.(e.nativeEvent)}
            >
                {text}
            </text>
        </g>
    )
}

function scaleStrokeWidth(strokeWidth: number, strokeScale: number): number {
    return R.round(strokeWidth / strokeScale, 3)
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
    idSuffix?: string
): string {
    return makePatternId(`${Patterns.projectedDataPattern}_${color}`, idSuffix)
}

export function makeProjectedDataLegendPatternId(idSuffix?: string): string {
    return makePatternId(Patterns.projectedDataPatternForLegend, idSuffix)
}
