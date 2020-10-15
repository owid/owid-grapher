import { DualAxis } from "grapher/axis/Axis"
import { AxisConfig, FontSizeManager } from "grapher/axis/AxisConfig"
import { ChartInterface } from "grapher/chart/ChartInterface"
import { ChartManager } from "grapher/chart/ChartManager"
import {
    BASE_FONT_SIZE,
    SeriesName,
    SeriesStrategy,
} from "grapher/core/GrapherConstants"
import { Bounds, DEFAULT_BOUNDS } from "grapher/utils/Bounds"
import { flatten, guid, max } from "grapher/utils/Util"
import { computed } from "mobx"
import { observer } from "mobx-react"
import React from "react"
import { stackSeries, withFakePoints } from "./StackedUtils"
import { StackedSeries } from "./StackedConstants"

export interface AbstactStackedChartProps {
    bounds?: Bounds
    manager: ChartManager
}

@observer
export class AbstactStackedChart
    extends React.Component<AbstactStackedChartProps>
    implements ChartInterface, FontSizeManager {
    @computed get manager() {
        return this.props.manager
    }
    @computed get bounds() {
        return this.props.bounds ?? DEFAULT_BOUNDS
    }

    @computed get fontSize() {
        return this.manager.baseFontSize ?? BASE_FONT_SIZE
    }

    protected get paddingForLegend() {
        return 0
    }

    @computed get renderUid() {
        return guid()
    }

    @computed protected get yColumns() {
        return this.yColumnSlugs.map((slug) => this.table.get(slug)!)
    }

    @computed protected get yColumnSlugs() {
        return this.manager.yColumnSlugs
            ? this.manager.yColumnSlugs
            : this.manager.yColumnSlug
            ? [this.manager.yColumnSlug]
            : this.inputTable.numericColumnSlugs
    }

    // It seems we have 2 types of StackedAreas. If only 1 column, we stack
    // the entities, and have one series per entity. If 2+ columns, we stack the columns
    // and have 1 series per column.
    @computed get seriesStrategy() {
        return (
            this.manager.seriesStrategy ||
            (this.yColumnSlugs.length > 1
                ? SeriesStrategy.column
                : SeriesStrategy.entity)
        )
    }

    @computed get inputTable() {
        return this.manager.table
    }

    @computed get table() {
        let table = this.inputTable
        table = table.filterBySelectedOnly()

        if (this.manager.isRelativeMode)
            table =
                this.seriesStrategy === SeriesStrategy.entity
                    ? table.toPercentageFromEachEntityForEachTime(
                          this.yColumnSlugs[0]
                      )
                    : table.toPercentageFromEachColumnForEachEntityAndTime(
                          this.yColumnSlugs
                      )
        return table
    }

    @computed protected get dualAxis() {
        const {
            bounds,
            horizontalAxisPart,
            verticalAxisPart,
            paddingForLegend,
        } = this
        return new DualAxis({
            bounds: bounds.padRight(paddingForLegend),
            horizontalAxis: horizontalAxisPart,
            verticalAxis: verticalAxisPart,
        })
    }

    @computed private get horizontalAxisPart() {
        const axisConfig =
            this.manager.xAxis || new AxisConfig(this.manager.xAxisConfig, this)
        if (this.manager.hideXAxis) axisConfig.hideAxis = true

        const axis = axisConfig.toHorizontalAxis()
        axis.updateDomainPreservingUserSettings(
            this.table.timeDomainFor(this.yColumnSlugs)
        )
        axis.formatColumn = this.inputTable.timeColumn
        axis.hideFractionalTicks = true
        axis.hideGridlines = true
        return axis
    }

    @computed private get verticalAxisPart() {
        // const lastSeries = this.series[this.series.length - 1]
        // const yValues = lastSeries.points.map((d) => d.yOffset + d.y)
        const yValues = this.allStackedPoints.map(
            (point) => point.y + point.yOffset
        )
        const axisConfig =
            this.manager.yAxis || new AxisConfig(this.manager.yAxisConfig, this)
        if (this.manager.hideYAxis) axisConfig.hideAxis = true
        const axis = axisConfig.toVerticalAxis()
        // Use user settings for axis, unless relative mode
        if (this.manager.isRelativeMode) axis.domain = [0, 100]
        else axis.updateDomainPreservingUserSettings([0, max(yValues) ?? 100]) // Stacked area chart must have its own y domain)
        axis.formatColumn = this.yColumns[0]
        return axis
    }

    @computed private get columnsAsSeries() {
        return this.yColumns.map((col) => {
            return {
                isProjection: col.isProjection,
                seriesName: col.displayName,
                rows: col.owidRows,
            }
        })
    }

    @computed private get entitiesAsSeries() {
        const { isProjection, owidRowsByEntityName } = this.yColumns[0]
        return this.table.selectedEntityNames.map((seriesName) => {
            return {
                isProjection,
                seriesName,
                rows: owidRowsByEntityName.get(seriesName) || [],
            }
        })
    }

    @computed protected get rawSeries() {
        return this.seriesStrategy === SeriesStrategy.column
            ? this.columnsAsSeries
            : this.entitiesAsSeries
    }

    @computed protected get allStackedPoints() {
        return flatten(this.series.map((series) => series.points))
    }

    @computed get failMessage() {
        const { yColumnSlugs } = this
        if (!yColumnSlugs.length) return "Missing variable"
        if (!this.series.length) return "No matching data"
        if (!this.allStackedPoints.length) return "No matching points"
        return ""
    }

    getColorForSeries(seriesName: SeriesName) {
        return "#ddd"
    }

    @computed get series() {
        const seriesArr = this.rawSeries
            .filter((series) => series.rows.length)
            .map((series) => {
                const { isProjection, seriesName, rows } = series
                return {
                    seriesName,
                    isProjection,
                    points: rows.map((row) => {
                        return {
                            x: row.time,
                            y: row.value,
                            yOffset: 0,
                        }
                    }),
                    color: this.getColorForSeries(seriesName),
                } as StackedSeries
            })

        if (this.seriesStrategy !== SeriesStrategy.entity) seriesArr.reverse()
        return stackSeries(withFakePoints(seriesArr))
    }
}
