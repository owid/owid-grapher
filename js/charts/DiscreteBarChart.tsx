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
import {computed, action, observable} from 'mobx'
import {observer} from 'mobx-react'
import ChartConfig from './ChartConfig'
import Bounds from './Bounds'
import LineType from './LineType'
import {getRelativeMouse, defaultTo} from './Util'
import AxisBox from './AxisBox'
import StandardAxisBoxView from './StandardAxisBoxView'
import Lines from './Lines'
import {preInstantiate} from "./Util"
import AxisScale from './AxisScale'
import Color from './Color'
import HorizontalAxis, {HorizontalAxisView} from './HorizontalAxis'
import {AxisGridLines} from './AxisBox'
import Vector2 from './Vector2'

export interface DiscreteBarDatum {
    value: number,
    label: string,
    color: Color
}

@observer
export default class DiscreteBarChart extends React.Component<{ bounds: Bounds, chart: ChartConfig }> {
    base: SVGGElement
    @observable.ref hoverIndex?: number

    @computed get chart() { return this.props.chart }
    @computed get bounds() { return this.props.bounds.padRight(10) }

    @computed get data() {
        return this.props.chart.discreteBar.data
    }

    @computed get legendFontSize() {
        return 0.7 
    }

    // Account for the width of the legend
    @computed get legendWidth() {
        const longestLabel = _.sortBy(this.data, d => -d.label.length)[0].label
        return Bounds.forText(longestLabel, { fontSize: this.legendFontSize+'em' }).width
    }

    // Account for the width of the little value labels at the end of bars
    @computed get valueFontSize() {
        return 0.6
    }

    @computed get maxValueWidth() {
        return Bounds.forText(_.sortBy(this.data, d => -d.value.toString().length)[0].value.toString(), { fontSize: this.valueFontSize+'em' }).width
    }

    @computed get hasNegative() {
        return _.some(this.data, d => d.value < 0)
    }

    // Now we can work out the main x axis scale
    @computed get xDomainDefault(): [number, number] {
        const allValues = _.map(this.data, d => d.value)
        const minX = Math.min(0, _.min(allValues) as number)
        const maxX = _.max(allValues) as number
        return [minX, maxX]
    }

    @computed get xRange() {
        return [this.bounds.left+this.legendWidth+(this.hasNegative ? this.maxValueWidth : 0), this.bounds.right-this.maxValueWidth]
    }

    @computed get xScale() {
        const xAxis = this.chart.yAxis.toSpec({ defaultDomain: this.xDomainDefault }) // XXX
        return new AxisScale(xAxis).extend({ domain: this.xDomainDefault, range: this.xRange })
    }

    @computed get xAxis() {
        const _this = this
        return new HorizontalAxis({
            get scale() { return _this.xScale },
            get labelText() { return _this.chart.yAxis.label }
        })
    }

    @computed get innerBounds() {
        return this.bounds.padLeft(this.legendWidth).padBottom(this.xAxis.height).padRight(this.maxValueWidth)
    }

    @computed get barHeight() {
        return 0.8 * this.innerBounds.height/this.data.length        
    }

    @computed get barSpacing() {
        return (this.innerBounds.height/this.data.length) - this.barHeight
    }

    @action.bound onMouseMove(ev: React.MouseEvent<SVGGElement>) {
        const mouse = Vector2.fromArray(getRelativeMouse(this.base, ev))
        const {barHeight, barSpacing} = this
//        console.log(mouse.y, barHeight+barSpacing, mouse.y/(barHeight+barSpacing))
        //this.hoverIndex = Math.floor(mouse.y/(barHeight+barSpacing)) 
    }

    @action.bound onMouseLeave() {
        this.hoverIndex = undefined
    }

    componentDidMount() {
        const bars = d3.select(this.base).selectAll("rect")
        const widths = bars.nodes().map((el: SVGRectElement) => el.getAttribute('width'))
        bars.attr('width', 0).transition().attr('width', (d, i) => widths[i])
    }

    render() {
        const {chart, data, bounds, legendWidth, xAxis, xScale, innerBounds, barHeight, barSpacing, valueFontSize, hoverIndex} = this

        let yOffset = this.innerBounds.top+barHeight/2

        return <g className="DiscreteBarChart" onMouseMove={this.onMouseMove} onMouseLeave={this.onMouseLeave}>
            <rect x={bounds.left} y={bounds.top} width={bounds.width} height={bounds.height} opacity={0} fill="rgba(255,255,255,0)"/>
            <HorizontalAxisView bounds={bounds} axis={xAxis}/>
            <AxisGridLines orient="bottom" scale={xScale} bounds={innerBounds}/>
            {_.map(data, (d, i) => {
                const isHover = i == hoverIndex
                const isFaded = !isHover && hoverIndex != undefined
                const isNegative = d.value < 0
                const barX = isNegative ? xScale.place(d.value) : xScale.place(0)
                const barWidth = isNegative ? xScale.place(0)-barX : xScale.place(d.value)-barX                

                const result = <g opacity={isFaded ? 0.5 : 1}>
                    <text x={bounds.left+legendWidth-5} y={yOffset} fill="#666" dominant-baseline="middle" textAnchor="end" fontSize={valueFontSize+'em'}>{d.label}</text>
                    <rect x={barX} y={yOffset-barHeight/2} width={barWidth} height={barHeight} fill="#F2585B" opacity={isHover ? 1 : 0.85}/>
                    <text x={xScale.place(d.value) + (isNegative ? -5 : 5)} y={yOffset} fill="#666" dominant-baseline="middle" textAnchor={isNegative ? "end" : "start"} fontSize="0.55em">{d.value}</text>
                </g>
                yOffset += barHeight+barSpacing
                return result
            })}
        </g>
    }
}