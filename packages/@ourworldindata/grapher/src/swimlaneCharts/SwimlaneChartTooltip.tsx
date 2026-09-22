import React from "react"
import { observer } from "mobx-react"
import * as R from "remeda"
import { EntityName } from "@ourworldindata/types"
import { Tooltip, TooltipState, TooltipTable } from "../tooltip/Tooltip"
import { TooltipTableProps } from "../tooltip/TooltipProps.js"
import { GRAPHER_OPACITY_MUTED } from "../core/GrapherConstants"
import { Emphasis } from "../interaction/Emphasis"
import {
    RenderSwimlaneSeries,
    SwimlaneTooltipTarget,
} from "./SwimlaneChartConstants"
import { SwimlaneChartState } from "./SwimlaneChartState"
import { findSegmentAtTime } from "./SwimlaneChartHelpers"

export interface SwimlaneChartTooltipProps {
    id: number
    chartState: SwimlaneChartState
    tooltipState: TooltipState<SwimlaneTooltipTarget>
    series: RenderSwimlaneSeries[]
    hoveredEntityName?: EntityName
    xAxisLabel?: string
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

    private get title(): string {
        const { target } = this
        if (!target) return ""
        return this.chartState.formatColumn.formatTime(target.time)
    }

    private get titleAnnotation(): string {
        return this.props.xAxisLabel ? `(${this.props.xAxisLabel})` : ""
    }

    private get subtitle(): string | undefined {
        return this.chartState.formatColumn.displayUnit
    }

    private get columns(): TooltipTableProps["columns"] {
        const { chartState } = this
        return [
            {
                label: chartState.formatColumn.displayName,
                formatValue: (value: unknown): string =>
                    R.isString(value)
                        ? (chartState.colorScale.getBinForValue(value)?.text ??
                          value)
                        : String(value),
            },
        ]
    }

    private toTooltipTableRow(
        series: RenderSwimlaneSeries
    ): TooltipTableProps["rows"][number] {
        const { target } = this

        const segment = target
            ? findSegmentAtTime(series.segments, target.time)
            : undefined
        const categorySegment =
            segment?.kind === "category" ? segment : undefined

        const blurred =
            series.emphasis === Emphasis.Muted || categorySegment === undefined
        const color =
            categorySegment?.color ?? this.chartState.colorScale.noDataColor
        const opacity = blurred ? GRAPHER_OPACITY_MUTED : 1

        return {
            name: series.seriesName,
            swatch: { color, opacity },
            blurred,
            focused: series.seriesName === this.props.hoveredEntityName,
            values: [categorySegment?.category],
        }
    }

    override render(): React.ReactElement | null {
        const { target } = this
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
                title={this.title}
                titleAnnotation={this.titleAnnotation}
                subtitle={this.subtitle}
                subtitleFormat="unit"
                dissolve={fading}
                dismiss={this.props.dismissTooltip}
            >
                <TooltipTable
                    columns={this.columns}
                    rows={this.props.series.map((series) =>
                        this.toTooltipTableRow(series)
                    )}
                />
            </Tooltip>
        )
    }
}
