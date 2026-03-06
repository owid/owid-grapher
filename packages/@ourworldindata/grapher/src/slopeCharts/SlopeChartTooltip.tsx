import React from "react"
import { computed } from "mobx"
import { observer } from "mobx-react"
import {
    excludeUndefined,
    calculateTrendDirection,
    Time,
} from "@ourworldindata/utils"
import { SlopeChartSeries } from "./SlopeChartConstants"
import { SlopeChartState } from "./SlopeChartState"
import {
    formatTooltipRangeValues,
    makeTooltipRoundingNotice,
    makeTooltipToleranceNotice,
    Tooltip,
    TooltipState,
    TooltipValueRange,
} from "../tooltip/Tooltip"
import { FooterItem, TooltipFooterIcon } from "../tooltip/TooltipProps"

export interface SlopeChartTooltipProps {
    chartState: SlopeChartState
    tooltipState: TooltipState<{ series: SlopeChartSeries }>
}

@observer
export class SlopeChartTooltip extends React.Component<SlopeChartTooltipProps> {
    @computed private get chartState(): SlopeChartState {
        return this.props.chartState
    }

    @computed private get series(): SlopeChartSeries | undefined {
        return this.props.tooltipState.target?.series
    }

    @computed private get subtitle(): string | undefined {
        const { series } = this
        if (!series) return undefined

        const { formatColumn, isRelativeMode } = this.chartState
        const formatTime = (time: Time): string => formatColumn.formatTime(time)

        const actualStartTime = series.start.originalTime
        const actualEndTime = series.end.originalTime
        const timeRange = `${formatTime(actualStartTime)} to ${formatTime(actualEndTime)}`

        return isRelativeMode
            ? `% change between ${formatTime(actualStartTime)} and ${formatTime(actualEndTime)}`
            : timeRange
    }

    @computed private get toleranceNotice(): FooterItem | undefined {
        const { series } = this
        if (!series) return undefined

        const { formatColumn, startTime, endTime } = this.chartState
        const formatTime = (time: Time): string => formatColumn.formatTime(time)

        const isStartValueOriginal = series.start.originalTime === startTime
        const isEndValueOriginal = series.end.originalTime === endTime

        let targetYear: string | undefined
        if (!isStartValueOriginal && !isEndValueOriginal) {
            targetYear = `${formatTime(startTime)} and ${formatTime(endTime)}`
        } else if (!isStartValueOriginal) {
            targetYear = formatTime(startTime)
        } else if (!isEndValueOriginal) {
            targetYear = formatTime(endTime)
        }

        if (!targetYear) return undefined

        return {
            icon: TooltipFooterIcon.Notice,
            text: makeTooltipToleranceNotice(targetYear),
        }
    }

    @computed private get roundingNotice(): FooterItem | undefined {
        const { series } = this
        if (!series) return undefined

        if (!series.column.roundsToSignificantFigures) return undefined

        return {
            icon: TooltipFooterIcon.None,
            text: makeTooltipRoundingNotice(
                [series.column.numSignificantFigures],
                { plural: !this.chartState.isRelativeMode }
            ),
        }
    }

    @computed private get footer(): FooterItem[] {
        return excludeUndefined([this.toleranceNotice, this.roundingNotice])
    }

    override render(): React.ReactElement | null {
        const { series } = this
        const { target, position, fading } = this.props.tooltipState

        if (!target || !series) return null

        const { isRelativeMode } = this.chartState
        const values = isRelativeMode
            ? [series.end.value]
            : [series.start.value, series.end.value]

        const targetYear = this.toleranceNotice !== undefined

        return (
            <Tooltip
                id="slopeTooltip"
                tooltipManager={this.chartState.manager}
                x={position.x}
                y={position.y}
                offsetX={20}
                offsetY={-16}
                style={{ maxWidth: "250px" }}
                title={series.displayName}
                titleAnnotation={series.annotation}
                subtitle={this.subtitle}
                subtitleFormat={targetYear ? "notice" : undefined}
                dissolve={fading}
                footer={this.footer}
                dismiss={() => (this.props.tooltipState.target = null)}
            >
                <TooltipValueRange
                    label={series.column.displayName}
                    unit={series.column.displayUnit}
                    values={formatTooltipRangeValues(values, series.column)}
                    trend={calculateTrendDirection(...values)}
                    isRoundedToSignificantFigures={
                        series.column.roundsToSignificantFigures
                    }
                    labelVariant="unit-only"
                />
            </Tooltip>
        )
    }
}
