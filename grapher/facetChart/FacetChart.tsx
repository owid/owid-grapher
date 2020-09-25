import React from "react"
import { observer } from "mobx-react"
import { Bounds, DEFAULT_BOUNDS } from "grapher/utils/Bounds"
import { computed } from "mobx"
import { ChartTypeName } from "grapher/core/GrapherConstants"
import { getChartComponent } from "grapher/chart/ChartTypeMap"
import { ChartOptionsProvider } from "grapher/chart/ChartOptionsProvider"
import { makeGrid } from "grapher/utils/Util"

interface FacetChartProps {
    bounds?: Bounds
    number?: number
    chartTypeName: ChartTypeName
    options: ChartOptionsProvider
}

// Facet by columnSlug. If the columnSlug is entityName than will do one chart per country. If it is an array of column slugs, then will do
// one chart per slug with series broken out.

interface SmallChart {
    bounds: Bounds
    chartTypeName: ChartTypeName
    options: ChartOptionsProvider
}

@observer
export class CountryFacet extends React.Component<FacetChartProps> {
    @computed protected get smallCharts() {
        const { rootTable, rootOptions } = this
        const { chartTypeName } = this.props
        const count = rootTable.availableEntityNames.length
        const boundsArr = this.bounds.split(count, 20)
        const { columns, rows } = makeGrid(count)
        const {
            yColumnSlug,
            xColumnSlug,
            yColumnSlugs,
            colorColumnSlug,
            sizeColumnSlug,
        } = rootOptions

        return rootTable.availableEntityNames.map((name, index) => {
            const bounds = boundsArr[index]
            const table = rootTable.clone()
            const column = index % columns
            const row = Math.floor(index / columns)
            const hideXAxis = row < rows - 1
            const hideYAxis = column > 0
            table.clearSelection()
            table.selectEntity(name)

            const options: ChartOptionsProvider = {
                table,
                hideXAxis,
                hideYAxis,
                baseFontSize: 8,
                lineStrokeWidth: 0.5,
                hideLegend: true,
                hidePoints: true,
                yColumnSlug,
                xColumnSlug,
                yColumnSlugs,
                colorColumnSlug,
                sizeColumnSlug,
            }
            return {
                bounds,
                chartTypeName,
                options,
            } as SmallChart
        })
    }

    @computed protected get bounds() {
        return this.props.bounds ?? DEFAULT_BOUNDS
    }

    @computed protected get rootTable() {
        return this.rootOptions.table
    }

    @computed protected get rootOptions() {
        return this.props.options
    }

    private renderSmallCharts() {
        return this.smallCharts.map((smallChart, index: number) => {
            const ChartComponent = getChartComponent(
                smallChart.chartTypeName
            ) as any // todo: how to type this?
            return (
                <ChartComponent
                    key={index}
                    bounds={smallChart.bounds}
                    options={smallChart.options}
                />
            )
        })
    }

    render() {
        const { width, height } = this.bounds
        return (
            <svg width={width} height={height}>
                {this.renderSmallCharts()}
            </svg>
        )
    }
}
