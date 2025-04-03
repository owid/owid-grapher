import React from "react"
import {
    InteractionState,
    makeIdForHumanConsumption,
} from "@ourworldindata/utils"
import {
    BLUR_FILL_OPACITY,
    BLUR_STROKE_OPACITY,
    ChoroplethSeries,
    DEFAULT_STROKE_COLOR,
    DEFAULT_STROKE_WIDTH,
    HOVER_STROKE_COLOR,
    HOVER_STROKE_WIDTH,
    PATTERN_STROKE_WIDTH,
    MapRenderFeature,
    SELECTED_STROKE_WIDTH,
    SVGMouseEvent,
    RenderFeature,
    RenderFeatureType,
} from "./MapChartConstants"

export function CountryOutsideOfSelectedRegion<Feature extends RenderFeature>({
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
    isSelected,
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
    isSelected: boolean
    hover: InteractionState
    strokeScale?: number
    onClick?: (event: SVGMouseEvent) => void
    onTouchStart?: (event: React.TouchEvent<SVGElement>) => void
    onMouseEnter?: (feature: Feature, event: MouseEvent) => void
    onMouseLeave?: () => void
}): React.ReactElement {
    const isHovered = hover.active

    const stroke =
        isHovered || isSelected ? HOVER_STROKE_COLOR : DEFAULT_STROKE_COLOR
    const strokeWidth = getStrokeWidth({ isHovered, isSelected }) / strokeScale
    const strokeOpacity = hover.background ? BLUR_STROKE_OPACITY : 1

    const fill = series.color
    const fillOpacity = hover.background ? BLUR_FILL_OPACITY : 1

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
    isSelected,
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
    isSelected: boolean
    hover: InteractionState
    strokeScale?: number
    onClick?: (event: SVGMouseEvent) => void
    onTouchStart?: (event: React.TouchEvent<SVGElement>) => void
    onMouseEnter?: (feature: Feature, event: MouseEvent) => void
    onMouseLeave?: () => void
}): React.ReactElement {
    const isHovered = hover.active

    const stroke = isHovered || isSelected ? HOVER_STROKE_COLOR : "#aaa"
    const strokeWidth = getStrokeWidth({ isHovered, isSelected }) / strokeScale
    const strokeOpacity = hover.background ? BLUR_STROKE_OPACITY : 1

    const fillOpacity = hover.background ? BLUR_FILL_OPACITY : 1

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

function isMapRenderFeature(
    feature: RenderFeature
): feature is MapRenderFeature {
    return feature.type === RenderFeatureType.Map
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
