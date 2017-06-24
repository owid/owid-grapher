/* StackedArea.tsx
 * ================
 *
 * A stacked area chart.
 *
 */

import * as React from 'react'
import * as _ from 'lodash'
import * as d3 from 'd3'
import * as $ from 'jquery'
import {computed, action} from 'mobx'
import {observer} from 'mobx-react'
import ChartConfig from './ChartConfig'
import Bounds from './Bounds'
import LineType from './LineType'
import {defaultTo} from './Util'
import EntitySelect from './owid.view.entitySelect'
import AxisBox from './AxisBox'
import StandardAxisBoxView from './StandardAxisBoxView'
import Lines from './Lines'
import {preInstantiate} from "./Util"
import Paragraph from './Paragraph'
import AxisScale from './AxisScale'

export interface LineChartValue {
    x: number,
    y: number,
    time: number,
    gapYearsToNext: number
}

export interface DiscreteBarValue {
    key: string,
    color: string,
    y: number
}

@observer
export default class DiscreteBarChart extends React.Component<{ bounds: Bounds, chart: ChartConfig, localData: any[] }, undefined> {
    @computed get chart() { return this.props.chart }
    @computed get bounds() { return this.props.bounds }

    @computed get values(): DiscreteBarValue[] {
        return this.props.localData[0].values
    }

    @computed get xDomainDefault(): [number, number] {
        return [0, this.values.length]
    }

    @computed get yDomainDefault(): [number, number] {
        return (d3.extent(_.map(this.values, 'y')) as [number, number])
    }   

    renderBars(bounds: Bounds) {
        const {chart, values, xDomainDefault, yDomainDefault} = this
        const xAxis = chart.xAxis.toSpec({ defaultDomain: xDomainDefault })
        const yAxis = chart.yAxis.toSpec({ defaultDomain: yDomainDefault })

        const axisBox = new AxisBox({bounds, xAxis, yAxis})

        return [
            <StandardAxisBoxView axisBox={axisBox} chart={chart}/>,
            <Bars values={values} xScale={axisBox.xScale} yScale={axisBox.yScale}/>
        ]
    }

    render() {
        const {chart, bounds, xDomainDefault, yDomainDefault} = this

        return <g className="StackedArea">
            {/*<Legend x={legend => bounds.right-legend.width} y={bounds.top} maxHeight={bounds.height} data={stackedData}>
                {legend => this.renderAreas(bounds.padRight(legend.width))}
            </Legend>*/}            
            {this.renderBars(bounds)}
        </g>
    }
}


export interface BarsProps {
    xScale: AxisScale,
    yScale: AxisScale,
    values: DiscreteBarValue[]
}

@observer
export class Bars extends React.Component<BarsProps, undefined> {
    render() {
        const {values, xScale, yScale} = this.props

        const barWidth = 10

        return <g className="Areas">
            {_.map(values, (v, i) => 
                <rect x={xScale.place(i)-barWidth/2} y={yScale.place(v.y)} width={barWidth} height={yScale.range[0]-yScale.place(v.y)} fill={v.color}/>
            )}
        </g>
    }
}