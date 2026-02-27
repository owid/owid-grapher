import * as React from "react"
import { Time } from "@ourworldindata/types"
import {
    PlacedStackedPoint,
    RenderStackedBarSeries,
    STACKED_BAR_STYLE,
} from "./StackedConstants"
import { makeFigmaId, makeSafeForCSS } from "@ourworldindata/utils"
import { Emphasis } from "../interaction/Emphasis"

export function StackedBars({
    series,
    onMouseOver,
    onMouseLeave,
}: {
    series: readonly RenderStackedBarSeries<Time>[]
    onMouseOver?: (
        bar: PlacedStackedPoint<Time>,
        series: RenderStackedBarSeries<Time>
    ) => void
    onMouseLeave?: () => void
}): React.ReactElement {
    return (
        <>
            {series.map((series, index) => (
                <g
                    key={index}
                    id={makeFigmaId(series.seriesName)}
                    className={makeSafeForCSS(series.seriesName) + "-segments"}
                >
                    {series.placedPoints.map((bar, index) => {
                        // TODO: don't render zero height bars
                        // if (bar.missing) return null

                        const isHovered = bar.time === series.hoverTime
                        const emphasis = isHovered
                            ? Emphasis.Highlighted
                            : (series.emphasis ?? Emphasis.Default)
                        const barOpacity = STACKED_BAR_STYLE[emphasis].opacity

                        return (
                            <rect
                                key={index}
                                // TODO: drop undefined check
                                id={
                                    bar.formattedTime !== undefined
                                        ? makeFigmaId(bar.formattedTime)
                                        : "0"
                                }
                                x={bar.x}
                                y={bar.y}
                                width={bar.barWidth}
                                height={bar.barHeight}
                                fill={bar.color ?? series.color}
                                opacity={barOpacity}
                                onMouseOver={() => onMouseOver?.(bar, series)}
                                onMouseLeave={() => onMouseLeave?.()}
                            />
                        )
                    })}
                </g>
            ))}
        </>
    )
}
