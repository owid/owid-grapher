import * as React from "react"
import { makeObservable } from "mobx"
import { observer } from "mobx-react"
import { SeriesName, Time } from "@ourworldindata/types"
import { DualAxis } from "../axis/Axis"
import { BAR_OPACITY, StackedPoint, StackedSeries } from "./StackedConstants"
import {
    makeIdForHumanConsumption,
    makeSafeForCSS,
} from "@ourworldindata/utils"
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
                        isLegendHovered || hoveredSeriesNames.length === 0
                            ? BAR_OPACITY.DEFAULT
                            : BAR_OPACITY.MUTE

                    return (
                        <g
                            key={index}
                            id={makeIdForHumanConsumption(series.seriesName)}
                            className={
                                makeSafeForCSS(series.seriesName) + "-segments"
                            }
                        >
                            {series.points.map((bar, index) => {
                                const xPos =
                                    horizontalAxis.place(bar.position) -
                                    barWidth / 2
                                const barOpacity =
                                    bar === hoveredBar
                                        ? BAR_OPACITY.FOCUS
                                        : opacity

                                return (
                                    <StackedBarSegment
                                        key={index}
                                        id={makeIdForHumanConsumption(
                                            formatColumn.formatTime(bar.time)
                                        )}
                                        bar={bar}
                                        color={bar.color ?? series.color}
                                        xOffset={xPos}
                                        opacity={barOpacity}
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
