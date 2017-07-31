import * as React from 'react'
import {computed, autorun} from 'mobx'
import {observer} from 'mobx-react'
import {preInstantiate} from './Util'
import Header from './Header'
import SourcesFooter from './SourcesFooter'
import SlopeChart from './SlopeChart'
import Bounds from './Bounds'
import ChartConfig from './ChartConfig'
import * as _ from 'lodash'
import * as d3 from 'd3'
import * as $ from 'jquery'
import owid from '../owid'
import EntitySelect from './owid.view.entitySelect'
import ScatterPlot from './ScatterPlot'
import LineChart from './LineChart'
import ChartView from './ChartView'
import AxisConfig from './AxisConfig'
import {defaultTo} from 'lodash'
import ChartType from './ChartType'
import LineType from './LineType'
import StackedArea from './StackedArea'
import DiscreteBarChart from './DiscreteBarChart'

@observer
export default class ChartTab extends React.Component<{ chart: ChartConfig, bounds: Bounds }, undefined> {
    @computed get header() {
        const {props} = this
        const {bounds, chart} = props

        let minYear = null
        let maxYear = null
        if (chart.type == ChartType.ScatterPlot) {
            minYear = chart.timeDomain[0];
            maxYear = chart.timeDomain[1];
        }

        return preInstantiate(<Header
            bounds={bounds}
            titleTemplate={chart.title}
            titleLink={chart.url.canonicalUrl}
            subtitleTemplate={chart.subtitle}
            logosSVG={chart.logosSVG}
            entities={chart.data.selectedKeys}
            entityType={chart.entityType}
            minYear={minYear}
            maxYear={maxYear}
        />)
    }

    @computed get footer() {
        const {props} = this
        const {chart} = props

        return preInstantiate(<SourcesFooter
            bounds={props.bounds}
			chart={chart}
            note={chart.note}
            originUrl={chart.originUrl}
         />)
    }

    renderChart() {
		const {chart, chartView} = this.props
		const {header, footer} = this
        const bounds = this.props.bounds.padTop(header.height).padBottom(footer.height)

        if (chart.type == ChartType.SlopeChart)
            return <SlopeChart bounds={bounds.padTop(20)} config={chart}/>
        else if (chart.type == ChartType.ScatterPlot)
            return <ScatterPlot bounds={bounds.padTop(20).padBottom(10)} config={chart} isStatic={this.props.chartView.isExport}/>
		else if (chart.type == ChartType.LineChart)
			return <LineChart bounds={bounds.padTop(20).padBottom(10)} chart={chart} localData={chart.data.chartData}/>
		else if (chart.type == ChartType.StackedArea)
			return <StackedArea bounds={bounds.padTop(20).padBottom(10)} chart={chart} localData={chart.data.chartData}/>
		else if (chart.type == ChartType.DiscreteBar)
			return <DiscreteBarChart bounds={bounds.padTop(20).padBottom(10)} chart={chart}/>
        else
            return null
    }

    render() {
        const {header, footer} = this

        return <g className="chartTab">
            <Header {...header.props}/>
            {this.renderChart()}
            <SourcesFooter {...footer.props}/>
        </g>
    }
}