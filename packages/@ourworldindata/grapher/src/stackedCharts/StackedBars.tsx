import * as React from "react"
import { makeObservable } from "mobx"
import { observer } from "mobx-react"
import { SeriesName, Time } from "@ourworldindata/types"
import { DualAxis } from "../axis/Axis"
import {
    barOpacityByState,
    StackedPoint,
    StackedSeries,
} from "./StackedConstants"
import { makeFigmaId, makeSafeForCSS } from "@ourworldindata/utils"
import { StackedBarSegment } from "./StackedBarSegment"
import { CoreColumn } from "@ourworldindata/core-table"

interface StackedBarsProps {
    dualAxis: DualAxis
    series: readonly StackedSeries<Time>[]
    formatColumn: CoreColumn
    hoveredSeriesNames?: SeriesName[]
    hoveredBar?: StackedPoint<Time>
    onBarMouseOver?: (
        bar: StackedPoint<Time>,
        series: StackedSeries<Time>
    ) => void
    onBarMouseLeave?: () => void
}

@observer
export class StackedBars extends React.Component<StackedBarsProps> {
    constructor(props: StackedBarsProps) {
        super(props)
        makeObservable(this)
    }

    override render(): React.ReactElement {
        const {
            dualAxis,
            series,
            formatColumn,
            hoveredSeriesNames = [],
            hoveredBar,
            onBarMouseOver,
            onBarMouseLeave,
        } = this.props

        const { verticalAxis, horizontalAxis } = dualAxis

        const barWidth = (horizontalAxis.bandWidth ?? 0) * 0.8

        return (
            <>
                {series.map((series, index) => {
                    const isLegendHovered = hoveredSeriesNames.includes(
                        series.seriesName
                    )
                    const opacity =
                        (isLegendHovered || hoveredSeriesNames.length === 0) &&
                        !series.focus?.background
                            ? barOpacityByState.default
                            : barOpacityByState.muted

                    return (
                        <g
                            key={index}
                            id={makeFigmaId(series.seriesName)}
                            className={
                                makeSafeForCSS(series.seriesName) + "-segments"
                            }
                        >
                            {series.points.map((bar, index) => {
                                const xPos =
                                    horizontalAxis.place(bar.position) -
                                    barWidth / 2
                                const finalOpacity =
                                    bar === hoveredBar ||
                                    series.focus?.active ||
                                    isLegendHovered
                                        ? barOpacityByState.focus
                                        : opacity

                                return (
                                    <StackedBarSegment
                                        key={index}
                                        id={makeFigmaId(
                                            formatColumn.formatTime(bar.time)
                                        )}
                                        bar={bar}
                                        color={bar.color ?? series.color}
                                        xOffset={xPos}
                                        opacity={finalOpacity}
                                        yAxis={verticalAxis}
                                        series={series}
                                        onBarMouseOver={onBarMouseOver}
                                        onBarMouseLeave={onBarMouseLeave}
                                        barWidth={barWidth}
                                    />
                                )
                            })}
                        </g>
                    )
                })}
            </>
        )
    }
}
