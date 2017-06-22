/* LineChart.tsx
 * ================
 *
 * A standard line chart.
 *
 */

import * as React from 'react'
import * as _ from 'lodash'
import * as nv from '../libs/nvd3'
import * as d3 from '../libs/d3old'
import * as $ from 'jquery'
import {computed, action} from 'mobx'
import {observer} from 'mobx-react'
import ChartConfig from './ChartConfig'
import Bounds from './Bounds'
import LineType from './LineType'
import {defaultTo} from './Util'
import Legend from './App.Views.Chart.Legend'
import EntitySelect from './owid.view.entitySelect'
import AxisBox from './AxisBox'
import StandardAxisBoxView from './StandardAxisBoxView'
import Lines from './Lines'
import {preInstantiate} from "./Util"

export interface LineChartValue {
    x: number,
    y: number,
    time: number,
    gapYearsToNext: number
}

export interface LineChartSeries {
    key: string,
    color: string,
    label: string
    values: LineChartValue[],
    classed?: string 
}

class 



@observer
export default class LineChart extends React.Component<{ bounds: Bounds, chart: ChartConfig, localData: LineChartSeries[] }, undefined> {
    @computed get chart() { return this.props.chart }
    @computed get bounds() { return this.props.bounds }

    @computed get localData(): LineChartSeries[] {
        return this.props.localData
    }

    @computed get allValues(): LineChartValue[] {
        return _.flatten(_.map(this.localData, series => series.values))
    }

    @computed get xDomainDefault(): [number, number] {
        return (d3.extent(this.allValues.map(function(d) { return d.x; })) as [number, number])
    }

    @computed get yDomainDefault(): [number, number] {
        return (d3.extent(this.allValues.map(function(d) { return d.y; })) as [number, number])
    }   

    @computed get axisBox() {
        const {chart, bounds, xDomainDefault, yDomainDefault} = this
        const xAxis = chart.xAxis.toSpec({ defaultDomain: xDomainDefault })
        const yAxis = chart.yAxis.toSpec({ defaultDomain: yDomainDefault })
        return new AxisBox({bounds, xAxis, yAxis})        
    }

    render() {
        const {chart, axisBox, localData} = this

        return <g className="LineChart">
            <StandardAxisBoxView axisBox={axisBox} chart={chart}/>
            <Lines xScale={axisBox.xScale} yScale={axisBox.yScale} data={localData}/>
        </g>
    }
}