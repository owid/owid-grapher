import React from "react"
import { observer } from "mobx-react"
import { DEFAULT_BOUNDS } from "grapher/utils/Bounds"
import { computed } from "mobx"
import {
    ChartTypeName,
    FacetStrategy,
    SeriesStrategy,
} from "grapher/core/GrapherConstants"
import {
    ChartComponentClassMap,
    DefaultChartClass,
} from "grapher/chart/ChartTypeMap"
import { ChartManager } from "grapher/chart/ChartManager"
import { makeGrid } from "grapher/utils/Util"
import { ChartInterface } from "grapher/chart/ChartInterface"
import { getChartPadding, getFontSize } from "./FacetChartUtils"
import {
    FacetSeries,
    FacetChartProps,
    PlacedFacetSeries,
} from "./FacetChartConstants"
import { OwidTable } from "coreTable/OwidTable"
import {
    autoDetectYColumnSlugs,
    makeSelectionArray,
} from "grapher/chart/ChartUtils"

const facetBackgroundColor = "transparent" // we don't use color yet but may use it for background later

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
            const hideLegend = false // !(column !== columns - 1) // todo: only show 1?
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

    @computed private get selectionArray() {
        return makeSelectionArray(this.manager)
    }

    @computed private get countryFacets(): FacetSeries[] {
        const table = this.inputTable.filterByEntityNames(
            this.selectionArray.selectedEntityNames
        )
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

        return this.selectionArray.selectedEntityNames.map((seriesName) => {
            return {
                seriesName,
                color: facetBackgroundColor,
                manager: {
                    table: this.inputTable.filterByEntityNames([seriesName]),
                    selection: [seriesName],
                    seriesStrategy: SeriesStrategy.column,
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
                color: facetBackgroundColor,
                manager: {
                    selection: this.selectionArray,
                    yColumnSlug: col.slug,
                    yColumnSlugs: [col.slug], // In a column facet strategy, only have 1 yColumn per chart.
                    seriesStrategy: SeriesStrategy.entity,
                },
            }
        })
    }

    @computed private get yColumns() {
        return this.yColumnSlugs.map((slug) => this.inputTable.get(slug))
    }

    @computed private get yColumnSlugs() {
        return autoDetectYColumnSlugs(this.manager)
    }

    @computed get series() {
        const { facetStrategy } = this.manager
        return facetStrategy === FacetStrategy.column
            ? this.columnFacets
            : this.countryFacets
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

    @computed private get subtitleFontSize() {
        const { placedSeries, manager } = this
        return getFontSize(placedSeries.length, manager.baseFontSize)
    }

    render() {
        const { subtitleFontSize } = this
        return this.placedSeries.map((smallChart, index: number) => {
            const ChartClass =
                ChartComponentClassMap.get(smallChart.chartTypeName) ??
                DefaultChartClass
            const { bounds, seriesName } = smallChart
            const shiftTop =
                smallChart.chartTypeName === ChartTypeName.LineChart ? 6 : 10
            return (
                <React.Fragment key={index}>
                    <text
                        x={bounds.x}
                        y={bounds.top - shiftTop}
                        fill={"#1d3d63"}
                        fontSize={subtitleFontSize}
                        style={{ fontWeight: 700 }}
                    >
                        {seriesName}
                    </text>
                    <ChartClass bounds={bounds} manager={smallChart.manager} />
                </React.Fragment>
            )
        })
    }
}
