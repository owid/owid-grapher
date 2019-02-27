/* LineChart.tsx
 * ================
 *
 * A standard line chart.
 *
 */

import * as React from 'react'
import { last, guid, sortBy } from './Util'
import { computed, action, observable } from 'mobx'
import { observer } from 'mobx-react'
import { select } from 'd3-selection'
import { easeLinear } from 'd3-ease'

import { ChartConfig } from './ChartConfig'
import { Bounds } from './Bounds'
import { AxisBox } from './AxisBox'
import { StandardAxisBoxView } from './StandardAxisBoxView'
import { Lines } from './Lines'
import { HeightedLegend, HeightedLegendView } from './HeightedLegend'
import { ComparisonLine } from './ComparisonLine'
import { Tooltip } from './Tooltip'
import { NoData } from './NoData'
import { formatYear } from './Util'
import { ChartViewContext, ChartViewContextType } from './ChartViewContext'

export interface LineChartValue {
    x: number,
    y: number,
    time: number
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
export class LineChart extends React.Component<{ bounds: Bounds, chart: ChartConfig }> {
    base: React.RefObject<SVGGElement> = React.createRef()

    static contextType = ChartViewContext
    context!: ChartViewContextType

    @observable hoverX?: number
    @action.bound onHover(hoverX: number|undefined) {
        this.hoverX = hoverX
    }

    @computed get chart() { return this.props.chart }
    @computed get bounds() { return this.props.bounds }
    @computed get transform() { return this.props.chart.lineChart }

    // Order of the legend items on a line chart should visually correspond
    // to the order of the lines as the approach the legend
    @computed get legendItems() {
        // If there are any projections, ignore non-projection legends
        // Bit of a hack
        let toShow = this.transform.groupedData
        if (toShow.some(g => !!g.isProjection))
            toShow = this.transform.groupedData.filter(g => g.isProjection)

        return toShow.map(d => {
            const lastValue = (last(d.values) as LineChartValue).y
            const valueStr = this.transform.yAxis.tickFormat(lastValue)

            return {
                color: d.color,
                key: d.key,
                // E.g. https://ourworldindata.org/grapher/size-poverty-gap-world
                label: this.chart.hideLegend ? valueStr : `${valueStr} ${this.chart.data.formatKey(d.key)}`,
                yValue: lastValue
            }
        })
    }

    @computed get legend(): HeightedLegend | undefined {
        const that = this
        return new HeightedLegend({
            get maxWidth() { return that.bounds.width / 3 },
            get fontSize() { return that.chart.baseFontSize },
            get items() { return that.legendItems }
        })
    }

    @computed get tooltip(): JSX.Element|undefined {
        const {transform, hoverX, axisBox, chart} = this

        if (hoverX === undefined)
            return undefined

        const sortedData = sortBy(transform.groupedData, series => {
            const value = series.values.find(v => v.x === hoverX)
            return value ? -value.y : -Infinity
        })

        return <Tooltip x={axisBox.xScale.place(hoverX)} y={axisBox.yScale.rangeMin + axisBox.yScale.rangeSize/2} style={{padding: "0.3em"}}>
            <table style={{fontSize: "0.9em", lineHeight: "1.4em"}}>
                <tbody>
                    <tr>
                        <td><strong>{formatYear(hoverX)}</strong></td>
                        <td>
                        </td>
                    </tr>
                    {sortedData.map(series => {
                        const value = series.values.find(v => v.x === hoverX)
                        return value ? <tr key={series.key}>
                            <td style={{paddingRight: "0.8em", fontSize: "0.9em"}}>
                                <div style={{width: '10px', height: '10px', backgroundColor: series.color, border: "1px solid #ccc", display: 'inline-block'}}/> {chart.data.formatKey(series.key)}
                            </td>
                            <td>{!value ? "No data" : transform.yAxis.tickFormat(value.y)}</td>
                        </tr> : null
                    })}
                </tbody>
            </table>
        </Tooltip>
    }

    @computed get axisBox() {
        const that = this
        return new AxisBox({
            get bounds() { return that.bounds.padRight(that.legend ? that.legend.width : 20) },
            get fontSize() { return that.chart.baseFontSize },
            get yAxis() { return that.transform.yAxis },
            get xAxis() { return that.transform.xAxis }
        })
    }

    @observable hoverKey?: string
    @action.bound onLegendClick(datakey: string) {
        if (this.chart.addCountryMode === 'add-country') {
            this.context.chartView.isSelectingData = true
            this.onLegendMouseLeave()
        }
    }

    @action.bound onLegendMouseOver(datakey: string) {
        this.hoverKey = datakey
    }

    @action.bound onLegendMouseLeave() {
        this.hoverKey = undefined
    }

    animSelection?: d3.Selection<d3.BaseType, {}, SVGGElement | null, {}>
    componentDidMount() {
        // Fancy intro animation

        const base = select(this.base.current)
        this.animSelection = base.selectAll("clipPath > rect")
            .attr("width", 0)

        this.animSelection
            .transition()
            .duration(800)
            .ease(easeLinear)
            .attr("width", this.bounds.width)
            .on("end", () => this.forceUpdate()) // Important in case bounds changes during transition
    }

    componentWillUnmount() {
        if (this.animSelection) this.animSelection.interrupt()
    }

    @computed get renderUid(): number {
        return guid()
    }

    render() {
        if (this.transform.failMessage)
            return <NoData bounds={this.props.bounds} message={this.transform.failMessage} />

        const { chart, transform, bounds, legend, tooltip, axisBox, renderUid, hoverX } = this
        const { xScale, yScale } = axisBox
        const { groupedData } = transform

        return <g ref={this.base} className="LineChart">
            <defs>
                <clipPath id={`boundsClip-${renderUid}`}>
                    {/* The tiny bit of extra space here is to ensure circles centered on the very edge are still fully visible */}
                    <rect x={axisBox.innerBounds.x-10} y={0} width={bounds.width+10} height={bounds.height * 2}></rect>
                </clipPath>
            </defs>
            <StandardAxisBoxView axisBox={axisBox} chart={chart} />
            <g clipPath={`url(#boundsClip-${renderUid})`}>
                {chart.comparisonLines && chart.comparisonLines.map((line, i) => <ComparisonLine key={i} axisBox={axisBox} comparisonLine={line} />)}
                {legend && <HeightedLegendView x={bounds.right - legend.width} legend={legend} focusKeys={[]} yScale={axisBox.yScale} onClick={this.onLegendClick} onMouseOver={this.onLegendMouseOver} onMouseLeave={this.onLegendMouseLeave}/>}
                <Lines axisBox={axisBox} xScale={axisBox.xScale} yScale={axisBox.yScale} data={groupedData} onHover={this.onHover} focusKeys={[]} />
            </g>
            {/*hoverTarget && <AxisBoxHighlight axisBox={axisBox} value={hoverTarget.value}/>*/}
            {hoverX && <g className="hoverIndicator">
                {transform.groupedData.map(series => {
                    const value = series.values.find(v => v.x === hoverX)
                    if (!value)
                        return null
                    else
                        return <circle key={series.key} cx={xScale.place(value.x)} cy={yScale.place(value.y)} r={5} fill={series.color}/>
                })}
                <line x1={xScale.place(hoverX)} y1={yScale.range[0]} x2={xScale.place(hoverX)} y2={yScale.range[1]} stroke="#ccc"/>
            </g>}

            {tooltip}
        </g>
    }
}
