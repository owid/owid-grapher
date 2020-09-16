import React from "react"
import { observer } from "mobx-react"
import { Bounds } from "grapher/utils/Bounds"
import { Grapher } from "grapher/core/Grapher"
import { computed } from "mobx"
import { ChartTypeName } from "grapher/core/GrapherConstants"
import { getChartComponent } from "grapher/chart/ChartTypeMap"

interface FacetChartProps {
    width: number
    height: number
    number: number
    padding: number
    chartTypeName: ChartTypeName
    grapher: Grapher
}

// Facet by columnSlug. If the columnSlug is entityName than will do one chart per country. If it is an array of column slugs, then will do
// one chart per slug with series broken out.

@observer
export class FacetChart extends React.Component<FacetChartProps> {
    @computed get smallCharts() {
        const { grapher, chartTypeName } = this.props
        const charts = this.bounds.split(
            this.props.number || 1,
            this.props.padding
        )
        const ChartComponent = getChartComponent(chartTypeName) as any // todo: how to type this?

        return charts.map((bounds: Bounds, index: number) => (
            <ChartComponent key={index} bounds={bounds} options={grapher} />
        ))
    }

    @computed get bounds() {
        const { width, height } = this.props
        return new Bounds(0, 0, width, height)
    }

    render() {
        const { width, height } = this.props
        return (
            <svg width={width} height={height}>
                {this.smallCharts}
            </svg>
        )
    }
}
