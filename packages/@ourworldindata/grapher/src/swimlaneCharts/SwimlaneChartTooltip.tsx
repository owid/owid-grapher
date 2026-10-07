import React from "react"
import { observer } from "mobx-react"
import { Tooltip, TooltipState } from "../tooltip/Tooltip"
import { TooltipValue } from "../tooltip/TooltipContents"
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

    private get formattedTimeRange(): string | undefined {
        const segment = this.target?.segment
        if (!segment) return undefined
        const { timeColumn } = this.chartState.inputTable
        return formatSegmentTimeRange({
            startTime: segment.startTime,
            endTime: segment.endTime,
            formatTime: (time) => timeColumn.formatTime(time),
        })
    }

    private get formattedDuration(): string | undefined {
        const segment = this.target?.segment
        if (!segment || segment.kind === "missing") return undefined
        const duration = segment.endTime - segment.startTime
        if (duration === 0) return undefined
        return formatTimeSpan(
            duration,
            this.chartState.inputTable.timeColumn.timeInterval
        )
    }

    override render(): React.ReactElement | null {
        const { target } = this
        const { position, fading } = this.props.tooltipState

        if (!target) return null

        const categorySegment =
            target.segment.kind === "category" ? target.segment : undefined

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
                <TooltipValue
                    value={categorySegment?.categoryLabel}
                    color={
                        categorySegment &&
                        darkenColorForText(categorySegment.color)
                    }
                    detail={this.formattedDuration}
                />
            </Tooltip>
        )
    }
}
