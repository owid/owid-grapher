/* LineChart.tsx
 * ================
 *
 * A standard line chart.
 *
 */

import * as React from 'react'
import * as _ from 'lodash'
import * as $ from 'jquery'
import * as d3 from 'd3'
import {computed, action, observable} from 'mobx'
import {observer} from 'mobx-react'
import ChartConfig from './ChartConfig'
import Bounds from './Bounds'
import LineType from './LineType'
import {defaultTo} from './Util'
import AxisBox from './AxisBox'
import StandardAxisBoxView from './StandardAxisBoxView'
import Lines from './Lines'
import {preInstantiate} from "./Util"
import Text from './Text'
import ColorLegend, {ColorLegendView} from './ColorLegend'
import Vector2 from './Vector2'
import {getRelativeMouse} from './Util'
import {HoverTarget} from './Lines'
import Tooltip from './Tooltip'
import AxisBoxHighlight from './AxisBoxHighlight'
import DataKey from './DataKey'

export interface LineChartValue {
    x: number,
    y: number,
    time: number,
    gapYearsToNext: number
}

export interface LineChartSeries {
    key: string,
    color: string,
    values: LineChartValue[],
    classed?: string,
    isProjection?: boolean
}

@observer
export default class LineChart extends React.Component<{ bounds: Bounds, chart: ChartConfig }> {
    base: SVGGElement
    @observable.ref tooltip: React.ReactNode|null

    @computed get chart() { return this.props.chart }
    @computed get bounds() { return this.props.bounds }
    @computed get transform() { return this.props.chart.lineChart }

    // Order of the legend items on a line chart should visually correspond
    // to the order of the lines as the approach the legend
    @computed get legendItems() {
        return _(this.transform.groupedData).sortBy(series => -(_.last(series.values) as LineChartValue).y).map(d => ({
            color: d.color,
            key: d.key,
            label: this.chart.data.formatKey(d.key)
        })).value()
    }

    @computed get legend() {
        const _this = this
        return new ColorLegend({
            maxWidth: 300,
            get items() { return _this.legendItems }
        })
    }

    @observable hoverTarget?: HoverTarget
    @action.bound onHoverPoint(target: HoverTarget) {
        this.hoverTarget = target
    }
    @action.bound onHoverStop() {
        this.hoverTarget = undefined
    }

    @computed get focusKeys(): DataKey[] {
        return this.hoverTarget ? [this.hoverTarget.series.key] : this.chart.data.selectedKeys
    }

    render() {
        const {chart, transform, bounds, legend, tooltip, hoverTarget, focusKeys} = this
        const {groupedData, xAxis, yAxis} = transform

        const axisBox = new AxisBox({bounds: bounds.padRight(10).padRight(legend.width), xAxis, yAxis})

        return <g className="LineChart">
            <ColorLegendView x={bounds.right-legend.width} y={bounds.top} legend={legend} focusKeys={focusKeys}/>
            <StandardAxisBoxView axisBox={axisBox} chart={chart}/>
            {/*hoverTarget && <AxisBoxHighlight axisBox={axisBox} value={hoverTarget.value}/>*/}
            <Lines xScale={axisBox.xScale} yScale={axisBox.yScale} data={groupedData} onHoverPoint={this.onHoverPoint} onHoverStop={this.onHoverStop} focusKeys={focusKeys}/>
            {tooltip}
        </g>
    }
}