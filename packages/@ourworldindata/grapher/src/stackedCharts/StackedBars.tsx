import * as React from "react"
import { Time } from "@ourworldindata/types"
import {
    BAR_OPACITY,
    PlacedStackedBarSeries,
    StackedPoint,
} from "./StackedConstants"
import { makeFigmaId, makeSafeForCSS } from "@ourworldindata/utils"
import { StackedBarSegment } from "./StackedBarSegment"
import { CoreColumn } from "@ourworldindata/core-table"

interface StackedBarsProps {
    series: readonly PlacedStackedBarSeries<Time>[]
    formatColumn: CoreColumn
    hoveredBar?: StackedPoint<Time>
    onBarMouseOver?: (
        bar: StackedPoint<Time>,
        series: PlacedStackedBarSeries<Time>
    ) => void
    onBarMouseLeave?: () => void
}

export function StackedBars(props: StackedBarsProps): React.ReactElement {
    const {
        formatColumn,
        hoveredBar,
        onBarMouseOver,
        onBarMouseLeave,
        series,
    } = props

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
                        {series.points.map((bar, index) => {
                            const barOpacity =
                                bar === hoveredBar ||
                                series.focus?.active ||
                                series.hover?.active
                                    ? BAR_OPACITY.FOCUS
                                    : opacity

                            return (
                                <StackedBarSegment
                                    key={index}
                                    id={makeFigmaId(
                                        formatColumn.formatTime(bar.time)
                                    )}
                                    bar={bar}
                                    color={bar.color ?? series.color}
                                    x={bar.x}
                                    y={bar.y}
                                    barWidth={bar.barWidth}
                                    barHeight={bar.barHeight}
                                    opacity={barOpacity}
                                    series={series}
                                    onBarMouseOver={onBarMouseOver}
                                    onBarMouseLeave={onBarMouseLeave}
                                />
                            )
                        })}
                    </g>
                )
            })}
        </>
    )
}
