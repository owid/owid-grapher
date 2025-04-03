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
    FOCUS_STROKE_COLOR,
    FOCUS_STROKE_WIDTH,
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
    hover: InteractionState
    strokeScale?: number
    onClick?: (event: SVGMouseEvent) => void
    onTouchStart?: (event: React.TouchEvent<SVGElement>) => void
    onMouseEnter?: (feature: Feature, event: MouseEvent) => void
    onMouseLeave?: () => void
}): React.ReactElement {
    const shouldShowSelectedStyle = series.isSelected
    const stroke =
        hover.active || shouldShowSelectedStyle
            ? FOCUS_STROKE_COLOR
            : DEFAULT_STROKE_COLOR
    const fill = series.color
    const fillOpacity = hover.background ? BLUR_FILL_OPACITY : 1
    const strokeOpacity = hover.background ? BLUR_STROKE_OPACITY : 1
    const strokeWidth =
        (hover.active
            ? FOCUS_STROKE_WIDTH
            : shouldShowSelectedStyle
              ? SELECTED_STROKE_WIDTH
              : DEFAULT_STROKE_WIDTH) / strokeScale

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
    hover: InteractionState
    strokeScale?: number
    onClick?: (event: SVGMouseEvent) => void
    onTouchStart?: (event: React.TouchEvent<SVGElement>) => void
    onMouseEnter?: (feature: Feature, event: MouseEvent) => void
    onMouseLeave?: () => void
}): React.ReactElement {
    const stroke = hover.active ? FOCUS_STROKE_COLOR : "#aaa"
    const fillOpacity = hover.background ? BLUR_FILL_OPACITY : 1
    const strokeOpacity = hover.background ? BLUR_STROKE_OPACITY : 1
    const strokeWidth =
        (hover.active ? FOCUS_STROKE_WIDTH : DEFAULT_STROKE_WIDTH) / strokeScale

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
