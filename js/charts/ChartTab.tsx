import * as React from 'react'
import { computed } from 'mobx'
import { observer } from 'mobx-react'
import Header from './Header'
import SourcesFooter from './SourcesFooter'
import SlopeChart from './SlopeChart'
import Bounds from './Bounds'
import ChartConfig from './ChartConfig'
import ScatterPlot from './ScatterPlot'
import LineChart from './LineChart'
import ChartView from './ChartView'
import StackedArea from './StackedArea'
import DiscreteBarChart from './DiscreteBarChart'
import StackedBarChart from './StackedBarChart'

@observer
export default class ChartTab extends React.Component<{ chart: ChartConfig, chartView: ChartView, bounds: Bounds }> {
    @computed get header() {
        const that = this

        return new Header({
            get chart() { return that.props.chart },
            get maxWidth() { return that.props.bounds.width }
        })
    }

    @computed get footer() {
        const that = this
        return new SourcesFooter({
            get chart() { return that.props.chart },
            get maxWidth() { return that.props.bounds.width }
        })
    }

    renderChart() {
        const { chart, chartView } = this.props
        const { header, footer } = this
        const bounds = this.props.bounds.padTop(header.height).padBottom(footer.height)

        if (chart.isSlopeChart)
            return <SlopeChart bounds={bounds.padTop(20)} chart={chart} />
        else if (chart.isScatter)
            return <ScatterPlot bounds={bounds.padTop(20).padBottom(15)} config={chart} isStatic={chartView.isExport} />
        else if (chart.isLineChart)
            return <LineChart bounds={bounds.padTop(20).padBottom(15)} chart={chart} />
        else if (chart.isStackedArea)
            return <StackedArea bounds={bounds.padTop(20).padBottom(15)} chart={chart} />
        else if (chart.isDiscreteBar)
            return <DiscreteBarChart bounds={bounds.padTop(20).padBottom(15)} chart={chart} />
        else if (chart.isStackedBar)
            return <StackedBarChart bounds={bounds.padTop(20).padBottom(15)} chart={chart} />
        else
            return null
    }

    render() {
        const { header, footer, props } = this

        return <g className="ChartTab">
            {header.render(props.bounds.x, props.bounds.y)}
            {this.renderChart()}
            {footer.render(props.bounds.x, props.bounds.bottom - footer.height)}
        </g>
    }
}
