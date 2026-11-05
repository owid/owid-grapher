import * as _ from "lodash-es"
import React from "react"
import { observer } from "mobx-react"
import { excludeUndefined } from "@ourworldindata/utils"
import { Time } from "@ourworldindata/types"
import { RenderLineChartSeries } from "./LineChartConstants"
import { LineChartState } from "./LineChartState.js"
import { findSeriesAtTime, hasPointAtTime } from "./LineChartHelpers"
import { joinEntityAnnotationTexts } from "../chart/ChartUtils"
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

interface TooltipRow {
    series: RenderLineChartSeries
    annotation: string | undefined
}

@observer
export class LineChartTooltip extends React.Component<LineChartTooltipProps> {
    private get chartState(): LineChartState {
        return this.props.chartState
    }

    private get target(): { time: Time } | undefined {
        return this.props.tooltipState.target ?? undefined
    }

    private get rows(): TooltipRow[] {
        const { target } = this
        if (!target) return []

        // Duplicate seriesNames will be present if there is a projected-values line
        const grouped = Map.groupBy(this.props.series, (s) => s.seriesName)

        return grouped
            .values()
            .map((seriesGroup): TooltipRow | undefined => {
                const series = findSeriesAtTime(seriesGroup, target.time)
                if (!series) return undefined
                const seriesWithAnnotation = seriesGroup.filter(
                    (s) => s === series || hasPointAtTime(s, target.time)
                )
                const annotation = joinEntityAnnotationTexts(
                    excludeUndefined(
                        seriesWithAnnotation.map(
                            (s) => s.entityAnnotation?.text
                        )
                    )
                )
                return { series, annotation }
            })
            .filter((row) => row !== undefined)
            .toArray()
    }

    private get hasProjectedSeries(): boolean {
        return this.rows.some(({ series }) => series.isProjection)
    }

    private get sortedRows(): TooltipRow[] {
        const { target, rows } = this
        if (!target) return []

        return _.sortBy(rows, ({ series }) => {
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

    private toTooltipTableRow({
        series,
        annotation,
    }: TooltipRow): TooltipTableProps["rows"][number] {
        const { target } = this

        const { displayName, isProjection: striped } = series

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
                    rows={this.sortedRows.map((row) =>
                        this.toTooltipTableRow(row)
                    )}
                />
            </Tooltip>
        )
    }
}
