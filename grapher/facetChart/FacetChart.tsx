import React from "react"
import { observer } from "mobx-react"
import { Bounds, DEFAULT_BOUNDS } from "grapher/utils/Bounds"
import { computed } from "mobx"
import { BASE_FONT_SIZE, ChartTypeName } from "grapher/core/GrapherConstants"
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

// not sure if we want to do something more sophisticated
const getFontSize = (count: number, baseFontSize: number, min = 8) => {
    if (count === 2) return baseFontSize
    if (count < 5) return baseFontSize - 2
    if (count < 10) return baseFontSize - 4
    if (count < 17) return baseFontSize - 6
    if (count < 36) return baseFontSize - 8
    return min
}

@observer
export class CountryFacet extends React.Component<FacetChartProps> {
    @computed protected get smallCharts() {
        const { rootTable, rootOptions } = this
        const { chartTypeName } = this.props
        const count = rootTable.selectedEntityNames.length
        const boundsArr = this.bounds.split(count, 20)
        const { columns, rows } = makeGrid(count)
        const {
            yColumnSlug,
            xColumnSlug,
            yColumnSlugs,
            colorColumnSlug,
            sizeColumnSlug,
        } = rootOptions

        const baseFontSize = getFontSize(
            count,
            rootOptions.baseFontSize ?? BASE_FONT_SIZE
        )

        return rootTable.selectedEntityNames.map((name, index) => {
            const bounds = boundsArr[index]
            const table = rootTable.facet()
            const column = index % columns
            const row = Math.floor(index / columns)
            const hideXAxis = row < rows - 1
            const hideYAxis = column > 0
            const hideLegend = !!(column !== columns - 1) // todo: only sho 1?
            const hidePoints = true
            table.clearSelection()
            table.selectEntity(name)

            const xAxis = undefined
            const yAxis = undefined

            const options: ChartOptionsProvider = {
                table,
                hideXAxis,
                hideYAxis,
                baseFontSize,
                lineStrokeWidth: 0.5,
                hideLegend,
                hidePoints,
                xAxis,
                yAxis,
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
