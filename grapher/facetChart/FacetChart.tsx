import React from "react"
import { observer } from "mobx-react"
import { Bounds } from "grapher/utils/Bounds"
import { computed } from "mobx"
import { ChartTypeName } from "grapher/core/GrapherConstants"
import { getChartComponent } from "grapher/chart/ChartTypeMap"
import { Grapher } from "grapher/core/Grapher"

interface FacetChartProps {
    width: number
    height: number
    number?: number
    padding: number
    chartTypeName: ChartTypeName
    options: Grapher
}

// Facet by columnSlug. If the columnSlug is entityName than will do one chart per country. If it is an array of column slugs, then will do
// one chart per slug with series broken out.

interface SmallChart {
    bounds: Bounds
    chartTypeName: ChartTypeName
    options: Grapher
}

@observer
export class FacetChart extends React.Component<FacetChartProps> {
    @computed protected get smallCharts() {
        const { options, chartTypeName } = this.props
        return this.bounds
            .split(this.props.number || 1, this.props.padding)
            .map((bounds) => {
                return {
                    bounds,
                    chartTypeName,
                    options,
                } as SmallChart
            })
    }

    @computed get bounds() {
        const { width, height } = this.props
        return new Bounds(0, 0, width, height)
    }

    @computed get rootTable() {
        return this.rootOptions.table
    }

    @computed get rootOptions() {
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
        const { width, height } = this.props
        return (
            <svg width={width} height={height}>
                {this.renderSmallCharts()}
            </svg>
        )
    }
}

@observer
export class CountryFacet extends FacetChart {
    @computed protected get smallCharts() {
        const { rootTable, rootOptions } = this
        const { chartTypeName } = this.props
        const count = rootTable.selectedEntityNames.length
        const boundsArr = this.bounds.split(count)

        return rootTable.selectedEntityNames.map((name, index) => {
            const table = rootTable.clone()
            table.selectEntity(name)
            const config = rootOptions.toObject()
            const options = new Grapher({
                ...config,
                table,
            })
            return {
                bounds: boundsArr[index],
                chartTypeName,
                options,
            } as SmallChart
        })
    }
}
