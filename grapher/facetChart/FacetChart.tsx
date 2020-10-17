import React from "react"
import { observer } from "mobx-react"
import { DEFAULT_BOUNDS } from "grapher/utils/Bounds"
import { computed } from "mobx"
import {
    ChartTypeName,
    FacetStrategy,
    SeriesStrategy,
} from "grapher/core/GrapherConstants"
import { getChartComponentClass } from "grapher/chart/ChartTypeMap"
import { ChartManager } from "grapher/chart/ChartManager"
import { makeGrid } from "grapher/utils/Util"
import { ChartInterface } from "grapher/chart/ChartInterface"
import { FacetSubtitle, getChartPadding, getFontSize } from "./FacetChartUtils"
import {
    FacetSeries,
    FacetChartProps,
    PlacedFacetSeries,
} from "./FacetChartConstants"
import { OwidTable } from "coreTable/OwidTable"

@observer
export class FacetChart
    extends React.Component<FacetChartProps>
    implements ChartInterface {
    transformTable(table: OwidTable) {
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

    @computed get placedSeries() {
        const { manager, series } = this
        const chartTypeName =
            this.props.chartTypeName ?? ChartTypeName.LineChart
        const count = series.length

        const boundsArr = this.bounds.split(count, getChartPadding(count))
        const { columns, rows } = makeGrid(count)
        const {
            yColumnSlug,
            xColumnSlug,
            yColumnSlugs,
            colorColumnSlug,
            sizeColumnSlug,
            isRelativeMode,
        } = manager

        const baseFontSize = getFontSize(count, manager.baseFontSize)
        const lineStrokeWidth = count > 16 ? 1 : undefined

        const table = this.inputTable

        return series.map((series, index) => {
            const bounds = boundsArr[index]
            const column = index % columns
            const row = Math.floor(index / columns)
            const hideXAxis = false // row < rows - 1 // todo: figure out design issues here
            const hideYAxis = false // column > 0 // todo: figure out design issues here
            const hideLegend = !!(column !== columns - 1) // todo: only show 1?
            const hidePoints = true
            const xAxisConfig = undefined
            const yAxisConfig = undefined

            const manager: ChartManager = {
                table,
                hideXAxis,
                hideYAxis,
                baseFontSize,
                lineStrokeWidth,
                hideLegend,
                hidePoints,
                xAxisConfig,
                yAxisConfig,
                yColumnSlug,
                xColumnSlug,
                yColumnSlugs,
                colorColumnSlug,
                sizeColumnSlug,
                isRelativeMode,
                ...series.manager,
            }
            return {
                bounds,
                chartTypeName: series.chartTypeName ?? chartTypeName,
                manager,
                seriesName: series.seriesName,
            } as PlacedFacetSeries
        })
    }

    @computed private get countryFacets(): FacetSeries[] {
        const table = this.inputTable.filterBySelectedOnly()
        const yDomain = table.domainFor(this.yColumnSlugs)
        const scaleType = this.manager.yAxis?.scaleType
        const sameYAxis = true
        const yAxisConfig = sameYAxis
            ? {
                  max: yDomain[1],
                  min: yDomain[0],
                  scaleType,
              }
            : undefined
        const sameXAxis = true
        const xAxisConfig = sameXAxis
            ? {
                  max: table.maxTime,
                  min: table.minTime,
                  scaleType,
              }
            : undefined

        const hideLegend = this.manager.yColumnSlugs?.length === 1

        return this.inputTable.selectedEntityNames.map((seriesName) => {
            return {
                seriesName,
                manager: {
                    table: this.inputTable
                        .filterByEntityName(seriesName)
                        .selectEntity(seriesName),
                    hideLegend,
                    yAxisConfig,
                    xAxisConfig,
                },
            }
        })
    }

    @computed private get columnFacets(): FacetSeries[] {
        return this.yColumns.map((col) => {
            return {
                seriesName: col.displayName,
                manager: {
                    yColumnSlug: col.slug,
                    yColumnSlugs: [col.slug], // In a column facet strategy, only have 1 yColumn per chart.
                    seriesStrategy: SeriesStrategy.entity,
                },
            }
        })
    }

    @computed private get columnMapFacets(): FacetSeries[] {
        return this.yColumns.map((col) => {
            return {
                chartTypeName: ChartTypeName.WorldMap,
                seriesName: col.displayName,
                manager: {
                    yColumnSlug: col.slug,
                },
            }
        })
    }

    @computed private get yColumns() {
        return this.yColumnSlugs.map((slug) => this.inputTable.get(slug)!)
    }

    @computed private get yColumnSlugs() {
        return this.manager.yColumnSlugs || []
    }

    @computed get series() {
        const { facetStrategy } = this.manager
        if (facetStrategy === FacetStrategy.column) return this.columnFacets
        if (facetStrategy === FacetStrategy.columnWithMap)
            return [...this.columnFacets, ...this.columnMapFacets]
        if (facetStrategy === FacetStrategy.countryWithMap)
            return [...this.countryFacets, ...this.columnMapFacets]
        return this.countryFacets
    }

    @computed protected get bounds() {
        return this.props.bounds ?? DEFAULT_BOUNDS
    }

    @computed protected get manager() {
        return this.props.manager
    }

    @computed get failMessage() {
        return ""
    }

    render() {
        const { placedSeries, manager } = this
        const fontSize = getFontSize(placedSeries.length, manager.baseFontSize)
        return placedSeries.map((smallChart, index: number) => {
            const ChartClass = getChartComponentClass(smallChart.chartTypeName)!
            const { bounds, seriesName } = smallChart
            return (
                <React.Fragment key={index}>
                    <ChartClass bounds={bounds} manager={smallChart.manager} />
                    {FacetSubtitle(seriesName, bounds, fontSize, index)}
                </React.Fragment>
            )
        })
    }
}
