/* LineChart.tsx
 * ================
 *
 * A standard line chart.
 *
 */

import * as React from 'react'
import {last} from './Util'
import {computed, action, observable} from 'mobx'
import {observer} from 'mobx-react'
import ChartConfig from './ChartConfig'
import Bounds from './Bounds'
import LineType from './LineType'
import {defaultTo} from './Util'
import AxisBox from './AxisBox'
import StandardAxisBoxView from './StandardAxisBoxView'
import Lines from './Lines'
import Text from './Text'
import HeightedLegend, {HeightedLegendView} from './HeightedLegend'
import Vector2 from './Vector2'
import {HoverTarget} from './Lines'
import Tooltip from './Tooltip'
import AxisBoxHighlight from './AxisBoxHighlight'
import DataKey from './DataKey'
import NoData from './NoData'
import {formatYear} from './Util'

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
    isProjection?: boolean,
    formatValue: (value: number) => string
}

@observer
export default class LineChart extends React.Component<{ bounds: Bounds, chart: ChartConfig }> {
    base: SVGGElement

    @computed get chart() { return this.props.chart }
    @computed get bounds() { return this.props.bounds }
    @computed get transform() { return this.props.chart.lineChart }

    // Order of the legend items on a line chart should visually correspond
    // to the order of the lines as the approach the legend
    @computed get legendItems() {
        return this.transform.groupedData.map(d => ({
            color: d.color,
            key: d.key,
            label: this.chart.data.formatKey(d.key),
            yValue: (last(d.values) as LineChartValue).y
        }))
    }

    @computed get legend(): HeightedLegend|undefined {
        if (this.chart.hideLegend)
            return undefined

        const _this = this
        return new HeightedLegend({
            get maxWidth() { return _this.bounds.width/3 },
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

    @computed get tooltip() {
        const {hoverTarget, chart, transform} = this
        if (hoverTarget == null) return undefined

        return <Tooltip x={hoverTarget.pos.x} y={hoverTarget.pos.y} style={{textAlign: "center"}}>
            <h3 style={{padding: "0.3em 0.9em", margin: 0, backgroundColor: "#fcfcfc", borderBottom: "1px solid #ebebeb", fontWeight: "normal", fontSize: "1em"}}>{chart.data.formatKey(hoverTarget.series.key)}</h3>
            <p style={{margin: 0, padding: "0.3em 0.9em", fontSize: "0.8em"}}>
                <span>{hoverTarget.series.formatValue(hoverTarget.value.y)}</span><br/>
                in<br/>
                <span>{formatYear(hoverTarget.value.x)}</span>
            </p>
        </Tooltip>
    }

    @action.bound onLegendClick(datakey: DataKey) {
        if (this.chart.addCountryMode == 'add-country') 
            this.chart.data.toggleKey(datakey)
    }

    render() {
        if (this.transform.failMessage)
            return <NoData bounds={this.props.bounds} message={this.transform.failMessage}/>

        const {chart, transform, bounds, legend, tooltip, hoverTarget, focusKeys} = this
        const {groupedData, xAxis, yAxis} = transform

        const axisBox = new AxisBox({bounds: bounds.padRight(10).padRight(legend ? legend.width : 0), xAxis, yAxis})

        return <g className="LineChart">
            {legend && <HeightedLegendView x={bounds.right-legend.width} legend={legend} focusKeys={focusKeys} yScale={axisBox.yScale} onClick={this.onLegendClick}/>}
            <StandardAxisBoxView axisBox={axisBox} chart={chart}/>
            {/*hoverTarget && <AxisBoxHighlight axisBox={axisBox} value={hoverTarget.value}/>*/}
            <Lines xScale={axisBox.xScale} yScale={axisBox.yScale} data={groupedData} onHoverPoint={this.onHoverPoint} onHoverStop={this.onHoverStop} focusKeys={focusKeys}/>
            {tooltip}
        </g>
    }
}