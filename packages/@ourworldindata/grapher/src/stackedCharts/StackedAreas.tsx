import * as React from "react"
import {
    pointsToPath,
    makeSafeForCSS,
    makeFigmaId,
} from "@ourworldindata/utils"
import { SeriesName, Time } from "@ourworldindata/types"
import { rgb } from "d3-color"
import { STACKED_AREA_STYLE, RenderStackedAreaSeries } from "./StackedConstants"
import { Emphasis } from "../interaction/Emphasis.js"

export function StackedAreas({
    series,
    onMouseEnter,
    onMouseLeave,
}: {
    series: RenderStackedAreaSeries<Time>[]
    onMouseEnter?: (seriesName: SeriesName) => void
    onMouseLeave?: () => void
}): React.ReactElement {
    return (
        <g className="Areas" id={makeFigmaId("stacked-areas")}>
            <g id={makeFigmaId("areas")}>
                {series.map((series) => (
                    <Area
                        key={series.seriesName}
                        series={series}
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
    onMouseEnter,
    onMouseLeave,
}: {
    series: RenderStackedAreaSeries<Time>
    onMouseEnter?: (seriesName: SeriesName) => void
    onMouseLeave?: () => void
}): React.ReactElement {
    const style = STACKED_AREA_STYLE[series.emphasis ?? Emphasis.Default]

    return (
        <path
            id={makeFigmaId(series.seriesName)}
            className={makeSafeForCSS(series.seriesName) + "-area"}
            key={series.seriesName + "-area"}
            strokeLinecap="round"
            d={pointsToPath(series.areaPoints)}
            fill={series.color}
            fillOpacity={style.fillOpacity}
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
    onMouseEnter,
    onMouseLeave,
}: {
    series: RenderStackedAreaSeries<Time>
    onMouseEnter?: (seriesName: SeriesName) => void
    onMouseLeave?: () => void
}): React.ReactElement {
    const style = STACKED_AREA_STYLE[series.emphasis ?? Emphasis.Default]

    return (
        <path
            id={makeFigmaId(series.seriesName)}
            className={makeSafeForCSS(series.seriesName) + "-border"}
            key={series.seriesName + "-border"}
            strokeLinecap="round"
            d={pointsToPath(series.placedPoints)}
            stroke={rgb(series.color).darker(0.5).toString()}
            strokeOpacity={style.borderOpacity}
            strokeWidth={style.borderWidth}
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
