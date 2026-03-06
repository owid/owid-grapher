import * as _ from "lodash-es"
import React from "react"
import { computed } from "mobx"
import { observer } from "mobx-react"
import { excludeUndefined, Time } from "@ourworldindata/utils"
import { StackedBarChartState } from "./StackedBarChartState.js"
import {
    StackedPoint,
    StackedSeries,
    STACKED_BAR_STYLE,
} from "./StackedConstants"
import { TooltipFooterIcon, FooterItem } from "../tooltip/TooltipProps.js"
import {
    Tooltip,
    TooltipState,
    TooltipTable,
    makeTooltipRoundingNotice,
    toTooltipTableColumns,
} from "../tooltip/Tooltip"
import { Emphasis } from "../interaction/Emphasis"

export interface StackedBarChartTooltipProps {
    chartState: StackedBarChartState
    tooltipState: TooltipState<{
        bar: StackedPoint<Time>
        series: StackedSeries<Time>
    }>
    xAxisLabel?: string
}

@observer
export class StackedBarChartTooltip extends React.Component<StackedBarChartTooltipProps> {
    @computed private get chartState(): StackedBarChartState {
        return this.props.chartState
    }

    @computed private get hoverTime(): number | undefined {
        return this.props.tooltipState.target?.bar.position
    }

    @computed private get roundingNotice(): FooterItem | undefined {
        const { formatColumn } = this.chartState
        if (!formatColumn.roundsToSignificantFigures) return undefined

        return {
            icon: TooltipFooterIcon.None,
            text: makeTooltipRoundingNotice([
                formatColumn.numSignificantFigures,
            ]),
        }
    }

    @computed private get footer(): FooterItem[] {
        return excludeUndefined([this.roundingNotice])
    }

    override render(): React.ReactElement | null {
        const { target, position, fading } = this.props.tooltipState
        const { hoverTime } = this

        if (!target || hoverTime === undefined) return null

        const { formatColumn, series } = this.chartState
        const hoverSeries = target.series

        const title = formatColumn.formatTime(hoverTime)
        const titleAnnotation = this.props.xAxisLabel
            ? `(${this.props.xAxisLabel})`
            : ""

        const totalValue = _.sum(
            series.map(
                ({ points }) =>
                    points.find((bar) => bar.position === hoverTime)?.value ?? 0
            )
        )

        const hoverPoints = series.map((series) => {
            const point = series.points.find(
                (bar) => bar.position === hoverTime
            )
            return {
                seriesName: series.seriesName,
                seriesColor: series.color,
                point,
            }
        })
        const [positivePoints, negativePoints] = _.partition(
            hoverPoints,
            ({ point }) => (point?.value ?? 0) >= 0
        )
        const sortedHoverPoints = [
            ...positivePoints.toReversed(),
            ...negativePoints,
        ]

        return (
            <Tooltip
                id="stackedBarTooltip"
                tooltipManager={this.chartState.manager}
                x={position.x}
                y={position.y}
                style={{ maxWidth: "500px" }}
                offsetX={20}
                offsetY={-16}
                title={title}
                titleAnnotation={titleAnnotation}
                subtitle={formatColumn.displayUnit}
                subtitleFormat="unit"
                footer={this.footer}
                dissolve={fading}
                dismiss={() => (this.props.tooltipState.target = null)}
            >
                <TooltipTable
                    columns={toTooltipTableColumns(formatColumn)}
                    totals={[totalValue]}
                    rows={sortedHoverPoints.map(
                        ({ point, seriesName: name, seriesColor }) => {
                            const focused = hoverSeries?.seriesName === name
                            const fake = point?.missing || point?.interpolated
                            const blurred = fake ?? true
                            const values = [fake ? undefined : point?.value]

                            const color = point?.color ?? seriesColor
                            const emphasis = focused
                                ? Emphasis.Highlighted
                                : Emphasis.Default
                            const opacity = STACKED_BAR_STYLE[emphasis].opacity
                            const swatch = { color, opacity }

                            return { name, swatch, blurred, focused, values }
                        }
                    )}
                />
            </Tooltip>
        )
    }
}
