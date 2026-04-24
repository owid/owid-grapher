import * as _ from "lodash-es"
import React from "react"
import { observer } from "mobx-react"
import { excludeUndefined } from "@ourworldindata/utils"
import { Time } from "@ourworldindata/types"
import { extent } from "d3-array"
import { RenderLineChartSeries } from "./LineChartConstants"
import { LineChartState } from "./LineChartState.js"
import { getAnnotationsForSeries } from "./LineChartHelpers"
import {
    Tooltip,
    TooltipState,
    TooltipTable,
    makeTooltipRoundingNotice,
    toTooltipTableColumns,
} from "../tooltip/Tooltip"
import {
    FooterItem,
    TooltipFooterIcon,
    TooltipProps,
    TooltipTableProps,
} from "../tooltip/TooltipProps.js"
import { GRAPHER_OPACITY_MUTED } from "../core/GrapherConstants"
import { darkenColorForLine } from "../color/ColorUtils"
import { Emphasis } from "../interaction/Emphasis"
import { CoreColumn } from "@ourworldindata/core-table"

export interface LineChartTooltipProps {
    id: number
    chartState: LineChartState
    tooltipState: TooltipState<{ time: Time }>
    series: RenderLineChartSeries[]
    xAxisLabel?: string
    dismissTooltip: () => void
}

@observer
export class LineChartTooltip extends React.Component<LineChartTooltipProps> {
    private get chartState(): LineChartState {
        return this.props.chartState
    }

    private get target(): { time: Time } | undefined {
        return this.props.tooltipState.target ?? undefined
    }

    private get series(): RenderLineChartSeries[] {
        const { target } = this
        if (!target) return []

        // Duplicate seriesNames will be present if there is a projected-values line
        const grouped = Map.groupBy(this.props.series, (s) => s.seriesName)

        return grouped
            .values()
            .map(
                (segments) =>
                    // Ideally pick series with a defined value at the target time
                    segments.find((series) =>
                        series.points.find((point) => point.x === target.time)
                    ) ??
                    // Otherwise pick the series whose start & end contains the target time
                    // and display a "No data" notice.
                    segments.find((series): boolean | void => {
                        const [startX, endX] = extent(
                            series.points,
                            ({ x }) => x
                        )
                        return (
                            _.isNumber(startX) &&
                            _.isNumber(endX) &&
                            startX < target.time &&
                            target.time < endX
                        )
                    })
            )
            .filter((series) => series !== undefined)
            .toArray()
    }

    private get hasProjectedSeries(): boolean {
        return this.series.some((series) => series.isProjection)
    }

    private get sortedSeries(): RenderLineChartSeries[] {
        const { target, series } = this
        if (!target) return []

        return _.sortBy(series, (series) => {
            const value = series.points.find((point) => point.x === target.time)
            return value !== undefined ? -value.y : Infinity
        })
    }

    private get projectionNotice(): FooterItem | undefined {
        if (!this.hasProjectedSeries) return undefined

        return { icon: TooltipFooterIcon.Stripes, text: "Projected data" }
    }

    private get roundingNotice(): FooterItem | undefined {
        const { formatColumn } = this.chartState

        if (!formatColumn.roundsToSignificantFigures) return undefined

        return {
            icon: TooltipFooterIcon.None,
            text: makeTooltipRoundingNotice([
                formatColumn.numSignificantFigures,
            ]),
        }
    }

    private get footer(): FooterItem[] {
        return excludeUndefined([this.projectionNotice, this.roundingNotice])
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
        const { isRelativeMode, startTime } = this.chartState.manager
        const { formatColumn } = this.chartState

        return isRelativeMode && startTime
            ? `% change since ${formatColumn.formatTime(startTime)}`
            : formatColumn.displayUnit
    }

    private get subtitleFormat(): TooltipProps["subtitleFormat"] {
        return this.subtitle === this.chartState.formatColumn.displayUnit
            ? "unit"
            : undefined
    }

    private get columns(): CoreColumn[] {
        const { formatColumn, colorColumn, hasColorScale } = this.chartState

        const columns = [formatColumn]
        if (hasColorScale && colorColumn.slug !== formatColumn.slug)
            columns.push(colorColumn)

        return columns
    }

    private toTooltipTableRow(
        series: RenderLineChartSeries
    ): TooltipTableProps["rows"][number] {
        const { target } = this

        const { seriesName, displayName, isProjection: striped } = series
        const annotation = getAnnotationsForSeries(
            this.chartState.annotationsMap,
            seriesName
        )

        const point = series.points.find((point) => point.x === target!.time)

        const blurred =
            series.emphasis === Emphasis.Muted || point === undefined

        const color = this.chartState.hasColorScale
            ? darkenColorForLine(
                  this.chartState.getColorScaleColor(point?.colorValue)
              )
            : series.color
        const opacity = blurred ? GRAPHER_OPACITY_MUTED : 1
        const swatch = { color, opacity }

        const values = excludeUndefined([
            point?.y,
            point?.colorValue as undefined | number,
        ])

        return {
            name: displayName,
            annotation,
            swatch,
            blurred,
            striped,
            values,
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
                subtitleFormat={this.subtitleFormat}
                footer={this.footer}
                dissolve={fading}
                dismiss={this.props.dismissTooltip}
            >
                <TooltipTable
                    columns={toTooltipTableColumns(this.columns)}
                    rows={this.sortedSeries.map((series) =>
                        this.toTooltipTableRow(series)
                    )}
                />
            </Tooltip>
        )
    }
}
