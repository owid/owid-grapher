import * as R from "remeda"
import React from "react"
import { computed } from "mobx"
import { observer } from "mobx-react"
import { excludeUndefined } from "@ourworldindata/utils"
import { SeriesName, Time } from "@ourworldindata/types"
import { StackedAreaChartState } from "./StackedAreaChartState.js"
import { STACKED_AREA_STYLE, StackedSeries } from "./StackedConstants"
import { TooltipFooterIcon, FooterItem } from "../tooltip/TooltipProps.js"
import {
    Tooltip,
    TooltipState,
    TooltipTable,
    makeTooltipRoundingNotice,
    toTooltipTableColumns,
} from "../tooltip/Tooltip"
import { Emphasis } from "../interaction/Emphasis"

export const STACKED_AREA_TOOLTIP_ID = "stackedAreaTooltip"

export interface StackedAreaChartTooltipProps {
    chartState: StackedAreaChartState
    tooltipState: TooltipState<{
        index: number
        series?: SeriesName
    }>
    series: readonly StackedSeries<Time>[]
    xAxisLabel?: string
    dismissTooltip: () => void
}

@observer
export class StackedAreaChartTooltip extends React.Component<StackedAreaChartTooltipProps> {
    @computed private get chartState(): StackedAreaChartState {
        return this.props.chartState
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
        if (!target) return null

        const { series } = this.props
        const hoveredPointIndex = target.index
        const bottomSeriesPoint = series[0]?.points[hoveredPointIndex]
        if (!bottomSeriesPoint) return null

        const { formatColumn } = this.chartState
        const formattedTime = formatColumn.formatTime(
            bottomSeriesPoint.position
        )
        const titleAnnotation = this.props.xAxisLabel
            ? `(${this.props.xAxisLabel})`
            : ""

        const lastStackedPoint = R.last(series)!.points[hoveredPointIndex]
        if (!lastStackedPoint) return null
        const totalValue = lastStackedPoint.value + lastStackedPoint.valueOffset

        return (
            <Tooltip
                id={STACKED_AREA_TOOLTIP_ID}
                tooltipManager={this.chartState.manager}
                x={position.x}
                y={position.y}
                offsetY={-16}
                offsetX={20}
                offsetXDirection="left"
                style={{ maxWidth: "50%" }}
                title={formattedTime}
                titleAnnotation={titleAnnotation}
                subtitle={formatColumn.displayUnit}
                subtitleFormat="unit"
                footer={this.footer}
                dissolve={fading}
                dismiss={this.props.dismissTooltip}
            >
                <TooltipTable
                    columns={toTooltipTableColumns(formatColumn)}
                    totals={[totalValue]}
                    rows={series.toReversed().map((series) => {
                        const { seriesName: name, color, points } = series
                        const point = points[hoveredPointIndex]
                        const focused = name === target.series
                        const values = [
                            point?.missing || point?.interpolated
                                ? undefined
                                : point?.value,
                        ]

                        const emphasis = focused
                            ? Emphasis.Highlighted
                            : Emphasis.Default
                        const opacity = STACKED_AREA_STYLE[emphasis].fillOpacity

                        const swatch = { color, opacity }

                        return {
                            name,
                            swatch,
                            focused,
                            values,
                        }
                    })}
                />
            </Tooltip>
        )
    }
}
