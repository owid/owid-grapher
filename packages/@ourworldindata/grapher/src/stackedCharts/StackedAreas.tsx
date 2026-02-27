import * as React from "react"
import {
    pointsToPath,
    makeSafeForCSS,
    makeFigmaId,
} from "@ourworldindata/utils"
import { SeriesName, Time } from "@ourworldindata/types"
import { rgb } from "d3-color"
import {
    AREA_OPACITY,
    BORDER_OPACITY,
    BORDER_WIDTH,
    RenderStackedAreaSeries,
} from "./StackedConstants"

export function StackedAreas({
    series,
    onMouseEnter,
    onMouseLeave,
}: {
    series: RenderStackedAreaSeries<Time>[]
    onMouseEnter?: (seriesName: SeriesName) => void
    onMouseLeave?: () => void
}): React.ReactElement {
    const isHoverModeActive = series.some((series) => series.hover?.active)
    const isFocusModeActive = series.some((series) => series.focus?.active)

    return (
        <g className="Areas" id={makeFigmaId("stacked-areas")}>
            <g id={makeFigmaId("areas")}>
                {series.map((series) => (
                    <Area
                        key={series.seriesName}
                        series={series}
                        isHoverModeActive={isHoverModeActive}
                        isFocusModeActive={isFocusModeActive}
                        onMouseEnter={onMouseEnter}
                        onMouseLeave={onMouseLeave}
                    />
                ))}
            </g>
            <g id={makeFigmaId("borders")}>
                {series.map((series) => (
                    <Border
                        key={series.seriesName}
                        series={series}
                        isHoverModeActive={isHoverModeActive}
                        isFocusModeActive={isFocusModeActive}
                        onMouseEnter={onMouseEnter}
                        onMouseLeave={onMouseLeave}
                    />
                ))}
            </g>
        </g>
    )
}

function Area({
    series,
    isHoverModeActive,
    isFocusModeActive,
    onMouseEnter,
    onMouseLeave,
}: {
    series: RenderStackedAreaSeries<Time>
    isHoverModeActive: boolean
    isFocusModeActive: boolean
    onMouseEnter?: (seriesName: SeriesName) => void
    onMouseLeave?: () => void
}): React.ReactElement {
    const opacity =
        !isHoverModeActive && !isFocusModeActive
            ? AREA_OPACITY.DEFAULT // normal opacity
            : series.hover?.active || series.focus?.active
              ? AREA_OPACITY.FOCUS // hovered or focused
              : AREA_OPACITY.MUTE // background

    return (
        <path
            id={makeFigmaId(series.seriesName)}
            className={makeSafeForCSS(series.seriesName) + "-area"}
            key={series.seriesName + "-area"}
            strokeLinecap="round"
            d={pointsToPath(series.areaPoints)}
            fill={series.color}
            fillOpacity={opacity}
            onMouseEnter={(): void => {
                onMouseEnter?.(series.seriesName)
            }}
            onMouseLeave={(): void => {
                onMouseLeave?.()
            }}
        />
    )
}

function Border({
    series,
    isHoverModeActive,
    isFocusModeActive,
    onMouseEnter,
    onMouseLeave,
}: {
    series: RenderStackedAreaSeries<Time>
    isHoverModeActive: boolean
    isFocusModeActive: boolean
    onMouseEnter?: (seriesName: SeriesName) => void
    onMouseLeave?: () => void
}): React.ReactElement {
    const opacity =
        !isHoverModeActive && !isFocusModeActive
            ? BORDER_OPACITY.DEFAULT // normal opacity
            : series.hover?.active || series.focus?.active
              ? BORDER_OPACITY.FOCUS // hovered or focused
              : BORDER_OPACITY.MUTE // background
    const strokeWidth =
        series.hover?.active || series.focus?.active
            ? BORDER_WIDTH.FOCUS
            : BORDER_WIDTH.DEFAULT

    return (
        <path
            id={makeFigmaId(series.seriesName)}
            className={makeSafeForCSS(series.seriesName) + "-border"}
            key={series.seriesName + "-border"}
            strokeLinecap="round"
            d={pointsToPath(series.placedPoints)}
            stroke={rgb(series.color).darker(0.5).toString()}
            strokeOpacity={opacity}
            strokeWidth={strokeWidth}
            fill="none"
            onMouseEnter={(): void => {
                onMouseEnter?.(series.seriesName)
            }}
            onMouseLeave={(): void => {
                onMouseLeave?.()
            }}
        />
    )
}
