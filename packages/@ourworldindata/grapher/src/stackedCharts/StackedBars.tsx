import * as React from "react"
import { Time } from "@ourworldindata/types"
import {
    BAR_OPACITY,
    PlacedStackedPoint,
    RenderStackedBarSeries,
} from "./StackedConstants"
import { makeFigmaId, makeSafeForCSS } from "@ourworldindata/utils"

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
            {series.map((series, index) => {
                const isHoverModeActive =
                    series.hover !== undefined && !series.hover.idle
                const opacity =
                    (!isHoverModeActive || series.hover?.active) &&
                    !series.focus?.background
                        ? BAR_OPACITY.DEFAULT
                        : BAR_OPACITY.MUTE

                return (
                    <g
                        key={index}
                        id={makeFigmaId(series.seriesName)}
                        className={
                            makeSafeForCSS(series.seriesName) + "-segments"
                        }
                    >
                        {series.placedPoints.map((bar, index) => {
                            // TODO: don't render zero height bars
                            // if (bar.missing) return null

                            const isHovered =
                                series.hoverTime !== undefined &&
                                bar.time === series.hoverTime
                            const barOpacity =
                                isHovered ||
                                series.focus?.active ||
                                series.hover?.active
                                    ? BAR_OPACITY.FOCUS
                                    : opacity

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
                                    onMouseOver={() =>
                                        onMouseOver?.(bar, series)
                                    }
                                    onMouseLeave={() => onMouseLeave?.()}
                                />
                            )
                        })}
                    </g>
                )
            })}
        </>
    )
}
