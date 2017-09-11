import * as React from 'react'
import {computed, autorun} from 'mobx'
import {observer} from 'mobx-react'
import Header from './Header'
import SourcesFooter from './SourcesFooter'
import SlopeChart from './SlopeChart'
import Bounds from './Bounds'
import ChartConfig from './ChartConfig'
import * as d3 from 'd3'
import ScatterPlot from './ScatterPlot'
import LineChart from './LineChart'
import ChartView from './ChartView'
import AxisConfig from './AxisConfig'
import {defaultTo} from './Util'
import ChartType from './ChartType'
import LineType from './LineType'
import StackedArea from './StackedArea'
import DiscreteBarChart from './DiscreteBarChart'

@observer
export default class ChartTab extends React.Component<{ chart: ChartConfig, chartView: ChartView, bounds: Bounds }> {
    // XXX refactor into the transforms
    @computed get minYear(): number|null {
        const {chart} = this.props
        //if (chart.isScatter && !chart.scatter.failMessage && chart.scatter.xOverrideYear != null)
        //    return null
        if (chart.isScatter && !chart.scatter.failMessage)
            return chart.scatter.startYear
        else if (chart.isDiscreteBar && !chart.discreteBar.failMessage)
            return chart.discreteBar.targetYear
        else
            return null
    }

    @computed get maxYear(): number|null {
        const {chart} = this.props
        //if (chart.isScatter && !chart.scatter.failMessage && chart.scatter.xOverrideYear != null)
        //    return null
        if (chart.isScatter && !chart.scatter.failMessage)
            return chart.scatter.endYear
        else if (chart.isDiscreteBar && !chart.discreteBar.failMessage)
            return chart.discreteBar.targetYear
        else
            return null
    }

    @computed get header() {
        const _this = this

        return new Header({
            get chart() { return _this.props.chart },
            get maxWidth() { return _this.props.bounds.width },
            get minYear() { return _this.minYear },
            get maxYear() { return _this.maxYear }
        })
    }

    @computed get footer() {
        const _this = this
        return new SourcesFooter({
            get chart() { return _this.props.chart },
            get maxWidth() { return _this.props.bounds.width }
        })
    }

    renderChart() {
		const {chart, chartView} = this.props
		const {header, footer} = this
        const bounds = this.props.bounds.padTop(header.height).padBottom(footer.height)

        if (chart.type == ChartType.SlopeChart)
            return <SlopeChart bounds={bounds.padTop(20)} chart={chart}/>
        else if (chart.type == ChartType.ScatterPlot)
            return <ScatterPlot bounds={bounds.padTop(20).padBottom(15)} config={chart} isStatic={chartView.isExport}/>
		else if (chart.type == ChartType.LineChart)
			return <LineChart bounds={bounds.padTop(20).padBottom(15)} chart={chart}/>
		else if (chart.type == ChartType.StackedArea)
			return <StackedArea bounds={bounds.padTop(20).padBottom(15)} chart={chart}/>
		else if (chart.type == ChartType.DiscreteBar)
			return <DiscreteBarChart bounds={bounds.padTop(20).padBottom(15)} chart={chart}/>
        else
            return null
    }

    render() {
        const {header, footer, props} = this

        return <g className="ChartTab">
            {header.render(props.bounds.x, props.bounds.y)}
            {this.renderChart()}
            {footer.render(props.bounds.x, props.bounds.bottom-footer.height)}
        </g>
    }
}