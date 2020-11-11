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
import { exposeInstanceOnWindow, flatten, guid, max } from "grapher/utils/Util"
import { computed } from "mobx"
import { observer } from "mobx-react"
import React from "react"
import { StackedSeries } from "./StackedConstants"
import { OwidTable } from "coreTable/OwidTable"
import {
    autoDetectSeriesStrategy,
    autoDetectYColumnSlugs,
    makeSelectionArray,
} from "grapher/chart/ChartUtils"
import { easeLinear, select } from "d3"

export interface AbstactStackedChartProps {
    bounds?: Bounds
    manager: ChartManager
    disableLinearInterpolation?: boolean // just for testing
}

@observer
export class AbstactStackedChart
    extends React.Component<AbstactStackedChartProps>
    implements ChartInterface, FontSizeManager {
    transformTable(table: OwidTable) {
        table = table.filterBySelectedOnly(
            this.selectionArray.selectedEntityNames
        )

        if (!this.props.disableLinearInterpolation) {
            this.yColumnSlugs.forEach((slug) => {
                table = table.interpolateColumnLinearly(slug)
            })
        }

        if (this.manager.isRelativeMode) {
            table = this.isEntitySeries
                ? table.toPercentageFromEachEntityForEachTime(
                      this.yColumnSlugs[0]
                  )
                : table.toPercentageFromEachColumnForEachEntityAndTime(
                      this.yColumnSlugs
                  )
        }
        return table
    }

    @computed get inputTable() {
        return this.manager.table
    }

    @computed get transformedTable() {
        return (
            this.manager.transformedTable ??
            this.transformTable(this.inputTable)
        )
    }

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
        return this.transformedTable.getColumns(this.yColumnSlugs)
    }

    @computed protected get yColumnSlugs() {
        return autoDetectYColumnSlugs(this.manager)
    }

    private animSelection?: d3.Selection<
        d3.BaseType,
        unknown,
        SVGGElement | null,
        unknown
    >

    base: React.RefObject<SVGGElement> = React.createRef()
    componentDidMount() {
        // Fancy intro animation
        this.animSelection = select(this.base.current)
            .selectAll("clipPath > rect")
            .attr("width", 0)

        this.animSelection
            .transition()
            .duration(800)
            .ease(easeLinear)
            .attr("width", this.bounds.width)
            .on("end", () => this.forceUpdate()) // Important in case bounds changes during transition

        exposeInstanceOnWindow(this)
    }

    componentWillUnmount() {
        if (this.animSelection) this.animSelection.interrupt()
    }

    @computed get seriesStrategy() {
        return autoDetectSeriesStrategy(this.manager)
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
            this.transformedTable.timeDomainFor(this.yColumnSlugs)
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

    @computed private get yColumnsInSelectionOrder() {
        // For stacked charts, we want the first selected series to be on top, so we reverse the order of the stacks.
        const slugsInSelectionOrder = this.manager.selectedColumnSlugs?.length
            ? this.manager.selectedColumnSlugs
            : this.yColumnSlugs
        return this.transformedTable.getColumns(slugsInSelectionOrder).reverse()
    }

    @computed private get columnsAsSeries() {
        return this.yColumnsInSelectionOrder.map((col) => {
            return {
                isProjection: col.isProjection,
                seriesName: col.displayName,
                rows: col.owidRows,
            }
        })
    }

    @computed private get entitiesAsSeries() {
        const { isProjection, owidRowsByEntityName } = this.yColumns[0]
        return this.selectionArray.selectedEntityNames
            .map((seriesName) => {
                return {
                    isProjection,
                    seriesName,
                    rows: owidRowsByEntityName.get(seriesName) || [],
                }
            })
            .reverse() // For stacked charts, we want the first selected series to be on top, so we reverse the order of the stacks.
    }

    @computed protected get rawSeries() {
        return this.isEntitySeries
            ? this.entitiesAsSeries
            : this.columnsAsSeries
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

    @computed protected get selectionArray() {
        return makeSelectionArray(this.manager)
    }

    @computed get isEntitySeries() {
        return this.seriesStrategy === SeriesStrategy.entity
    }

    @computed get seriesColors() {
        return this.series.map((series) => series.color)
    }

    @computed get unstackedSeries() {
        return this.rawSeries
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
    }

    @computed get series() {
        return this.unstackedSeries
    }
}
