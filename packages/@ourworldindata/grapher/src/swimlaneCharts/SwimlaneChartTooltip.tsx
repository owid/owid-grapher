import React from "react"
import { observer } from "mobx-react"
import { Tooltip, TooltipState } from "../tooltip/Tooltip"
import { TooltipValue } from "../tooltip/TooltipContents"
import { darkenColorForText } from "../color/ColorUtils"
import { SwimlaneTooltipTarget } from "./SwimlaneChartConstants"
import { SwimlaneChartState } from "./SwimlaneChartState"
import { formatSegmentDuration } from "./SwimlaneChartHelpers"

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

    private get annotation(): string | undefined {
        return this.chartState.series.find(
            (series) => series.entityName === this.target?.entityName
        )?.annotation
    }

    private get formattedDuration(): string | undefined {
        const segment = this.target?.segment
        const { timeColumn } = this.chartState
        if (!segment || !timeColumn) return undefined
        return formatSegmentDuration({ segment, timeColumn })
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
                titleAnnotation={this.annotation}
                subtitle={target.segment.timeRangeLabel}
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
                    noDataLabel={this.chartState.colorScale.noDataLabel}
                />
            </Tooltip>
        )
    }
}
