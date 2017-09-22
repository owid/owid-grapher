/* StackedArea.tsx
 * ================
 *
 * A stacked area chart.
 *
 */

import * as React from 'react'
import {sortBy, reverse, clone, last} from './Util'
import {computed, action, observable} from 'mobx'
import {observer} from 'mobx-react'
import ChartConfig from './ChartConfig'
import Bounds from './Bounds'
import AxisBox from './AxisBox'
import StandardAxisBoxView from './StandardAxisBoxView'
import {getRelativeMouse} from './Util'
import HeightedLegend, {HeightedLegendView} from './HeightedLegend'
import NoData from './NoData'
import Tooltip from './Tooltip'
import {select} from 'd3-selection'
import {easeLinear} from 'd3-ease'

export interface StackedAreaValue {
    x: number,
    y: number,
    time: number,
    isFake?: true
}

export interface StackedAreaSeries {
    key: string,
    color: string,
    values: StackedAreaValue[],
    classed?: string,
    isProjection?: boolean,
}

function pathify(points: [number, number][]) {
    let path = ""
    for (let i = 0; i < points.length; i++) {
        if (i == 0)
            path += `M${points[i][0]} ${points[i][1]}`
        else
            path += `L${points[i][0]} ${points[i][1]}`
    }
    return path
}

interface AreasProps extends React.SVGAttributes<SVGGElement> {
    axisBox: AxisBox
    data: StackedAreaSeries[]
    onHover: (hoverIndex: number|undefined) => void 
}

@observer
export class Areas extends React.Component<AreasProps> {
    base: SVGGElement
    
    @observable hoverIndex?: number

    @action.bound onMouseMove(ev: React.MouseEvent<SVGGElement>) {
        const {axisBox, data} = this.props

        const mouse = getRelativeMouse(this.base, ev)
        
        if (axisBox.innerBounds.contains(mouse)) {
            const closestPoint = sortBy(data[0].values, d => Math.abs(axisBox.xScale.place(d.x) - mouse.x))[0]
            const index = data[0].values.indexOf(closestPoint)
            this.hoverIndex = index
        } else {
            this.hoverIndex = undefined
        }

        this.props.onHover(this.hoverIndex)
    }

    @computed get polylines(): JSX.Element[] {
        const {axisBox, data} = this.props
        const {xScale, yScale} = axisBox
        const xBottomLeft = [xScale.range[0], yScale.range[0]]
        const xBottomRight = [xScale.range[1], yScale.range[0]]

        // Stacked area chart stacks each series upon the previous series, so we must keep track of the last point set we used
        let prevPoints = [xBottomLeft, xBottomRight]
        return data.map(series => {
            const mainPoints = series.values.map(v => [xScale.place(v.x), yScale.place(v.y)] as [number, number])
            const points = mainPoints.concat(reverse(clone(prevPoints)))
            prevPoints = mainPoints

            return <path
                key={series.key+'-line'}
                strokeLinecap="round"
                stroke={"#fff"}
                d={pathify(points)}
                fill={series.color}
                strokeWidth={0.5}
                clipPath={this.props.clipPath}
            />
        })
    }

    render() {
        const {axisBox, data} = this.props
        const {xScale, yScale} = axisBox
        const {hoverIndex} = this

        return <g className="Areas" opacity={0.7} onMouseMove={this.onMouseMove} onMouseLeave={this.onMouseMove}>
            <rect x={xScale.range[0]} y={yScale.range[1]} width={xScale.range[1]-xScale.range[0]} height={yScale.range[0]-yScale.range[1]} opacity={0} fill="rgba(255,255,255,0)"/> 
            {this.polylines}
            {hoverIndex != null && <g className="hoverIndicator">
                {data.map(series => {
                    return <circle cx={xScale.place(series.values[hoverIndex].x)} cy={yScale.place(series.values[hoverIndex].y)} r={5} fill={series.color}/>
                })}
                <line x1={xScale.place(data[0].values[hoverIndex].x)} y1={yScale.range[0]} x2={xScale.place(data[0].values[hoverIndex].x)} y2={yScale.range[1]} stroke="#ccc"/>
            </g>}
        </g>
    }
}

@observer
export default class StackedAreaChart extends React.Component<{ bounds: Bounds, chart: ChartConfig }> {
    @computed get chart(): ChartConfig { return this.props.chart }
    @computed get bounds(): Bounds { return this.props.bounds }
    @computed get transform() { return this.props.chart.stackedArea }


    @computed get midpoints(): number[] {
        let prevY = 0
        return this.transform.stackedData.map(series => {
            const lastValue = last(series.values) as StackedAreaValue
            const middleY = prevY + (lastValue.y - prevY)/2
            prevY = lastValue.y
            return middleY
        })
    }

    @computed get legendItems() {
        const {transform, midpoints} = this
        const items = transform.stackedData.map((d, i) => ({
            color: d.color,
            key: d.key,
            label: this.chart.data.formatKey(d.key),
            yValue: midpoints[i]
        }))
        return sortBy(items, d => d.yValue)
    }

    @computed get legend(): HeightedLegend|undefined {
        if (this.chart.hideLegend)
            return undefined

        const _this = this
        return new HeightedLegend({
            get maxWidth() { return 150 },
            get items() { return _this.legendItems }
        })
    }

    @computed get axisBox(): AxisBox {
        const {bounds, transform, legend} = this
        const {xAxis, yAxis} = transform
        return new AxisBox({bounds: bounds.padRight(legend ? legend.width+5 : 20), xAxis, yAxis})
    }

    @observable hoverIndex: number
    @action.bound onHover(hoverIndex: number) {
        this.hoverIndex = hoverIndex
    }

    @computed get tooltip(): JSX.Element|undefined {
        if (this.hoverIndex == null) return undefined

        const {transform, hoverIndex, axisBox, chart} = this

        // Grab the first value to get the year from
        const refValue = transform.stackedData[0].values[hoverIndex]

        // If some data is missing, don't calculate a total
        const someMissing = transform.stackedData.some(g => !!g.values[hoverIndex].isFake)

        return <Tooltip x={axisBox.xScale.place(refValue.x)} y={axisBox.yScale.rangeMin + axisBox.yScale.rangeSize/2} style={{padding: "0.3em"}}>
            <table style={{fontSize: "0.9em", lineHeight: "1.4em"}}>
                <tr>
                    <td><strong>{refValue.x}</strong></td>
                    <td>
                        {!transform.isRelative && !someMissing && <span>
                            <strong>{transform.yAxis.tickFormat(transform.stackedData[transform.stackedData.length-1].values[hoverIndex].y)}</strong>
                        </span>}
                    </td>
                </tr>
                {reverse(clone(transform.groupedData)).map(series => {
                    const value = series.values[hoverIndex]
                    return <tr>
                        <td style={{paddingRight: "0.8em", fontSize: "0.9em"}}>
                            <div style={{width: '10px', height: '10px', backgroundColor: series.color, border: "1px solid #ccc", display: 'inline-block'}}/> {chart.data.formatKey(series.key)}
                        </td>
                        <td>{value.isFake ? "No data" : transform.yAxis.tickFormat(value.y)}</td>
                    </tr>
                })}
            </table>
        </Tooltip>
    }

    base: SVGGElement
    componentDidMount() {
        // Fancy intro animation

        const base = select(this.base)
        base.selectAll("clipPath > rect")
            .attr("width", 0)
            .transition()
                .duration(800)
                .ease(easeLinear)
                .attr("width", this.bounds.width)
    }

    render() {
        if (this.transform.failMessage)
            return <NoData bounds={this.props.bounds} message={this.transform.failMessage}/>
            
        const {chart, bounds, axisBox, legend, transform} = this
        return <g className="StackedArea">
            <defs>
                <clipPath id="boundsClip">
                    <rect x={axisBox.innerBounds.x} y={0} width={bounds.width} height={bounds.height*2}></rect>
                </clipPath>
            </defs>
            <StandardAxisBoxView axisBox={axisBox} chart={chart}/>
            <g clipPath="url(#boundsClip)">
                {legend && <HeightedLegendView legend={legend} x={bounds.right-legend.width} yScale={axisBox.yScale} focusKeys={[]}/>}
                <Areas axisBox={axisBox} data={transform.stackedData} onHover={this.onHover}/>
            </g>
            {this.tooltip}
        </g>
    }
}
