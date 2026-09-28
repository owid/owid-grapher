import React from "react"
import { observer } from "mobx-react"
import { Time } from "@ourworldindata/types"
import { Tooltip, TooltipState } from "../tooltip/Tooltip"
import { formatTimeSpan } from "../chart/ChartUtils"
import { darkenColorForText } from "../color/ColorUtils"
import { SwimlaneTooltipTarget } from "./SwimlaneChartConstants"
import { SwimlaneChartState } from "./SwimlaneChartState"
import { formatSegmentTimeRange } from "./SwimlaneLabels"

export interface SwimlaneChartTooltipProps {
    id: number
    chartState: SwimlaneChartState
    tooltipState: TooltipState<SwimlaneTooltipTarget>
    dismissTooltip: () => void
}

@observer
export class SwimlaneChartTooltip extends React.Component<SwimlaneChartTooltipProps> {
    private get chartState(): SwimlaneChartState {
        return this.props.chartState
    }

    private get target(): SwimlaneTooltipTarget | undefined {
        return this.props.tooltipState.target ?? undefined
    }

    /** The whole category run, or the gap itself for missing data */
    private get timeRange(): { startTime: Time; endTime: Time } | undefined {
        const segment = this.target?.segment
        if (!segment) return undefined
        return segment.kind === "category"
            ? { startTime: segment.runStartTime, endTime: segment.runEndTime }
            : { startTime: segment.startTime, endTime: segment.endTime }
    }

    private get formattedTimeRange(): string | undefined {
        const { timeRange } = this
        if (!timeRange) return undefined
        const { timeColumn } = this.chartState.inputTable
        return formatSegmentTimeRange({
            runStartTime: timeRange.startTime,
            runEndTime: timeRange.endTime,
            formatTime: (time) => timeColumn.formatTime(time),
        })
    }

    private get formattedDuration(): string | undefined {
        const { timeRange } = this
        if (!timeRange || this.target?.segment.kind === "missing")
            return undefined
        const duration = timeRange.endTime - timeRange.startTime
        if (duration === 0) return undefined
        return formatTimeSpan(
            duration,
            this.chartState.inputTable.timeColumn.timeInterval
        )
    }

    private renderCategory(): React.ReactElement | null {
        const segment = this.target?.segment
        if (!segment) return null

        if (segment.kind === "missing")
            return (
                <div className="swimlane-tooltip__category swimlane-tooltip__category--missing">
                    No data
                </div>
            )

        const label =
            this.chartState.colorScale.getBinForValue(segment.category)?.text ??
            segment.category
        return (
            <div
                className="swimlane-tooltip__category"
                style={{ color: darkenColorForText(segment.color) }}
            >
                {label}
            </div>
        )
    }

    override render(): React.ReactElement | null {
        const { target, formattedDuration } = this
        const { position, fading } = this.props.tooltipState

        if (!target) return null

        return (
            <Tooltip
                id={this.props.id}
                tooltipManager={this.chartState.manager}
                x={position.x}
                y={position.y}
                style={{ maxWidth: "400px" }}
                offsetXDirection="left"
                offsetX={20}
                offsetY={-16}
                title={target.entityName}
                subtitle={this.formattedTimeRange}
                dissolve={fading}
                dismiss={this.props.dismissTooltip}
            >
                <div className="swimlane-tooltip">
                    {this.renderCategory()}
                    {formattedDuration && (
                        <div className="swimlane-tooltip__duration">
                            {formattedDuration}
                        </div>
                    )}
                </div>
            </Tooltip>
        )
    }
}
