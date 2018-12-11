/* LineChart.tsx
 * ================
 *
 * A standard line chart.
 *
 */

import * as React from 'react'
import { last, guid } from './Util'
import { computed, action, observable } from 'mobx'
import { observer } from 'mobx-react'
import { select } from 'd3-selection'
import { easeLinear } from 'd3-ease'

import ChartConfig from './ChartConfig'
import Bounds from './Bounds'
import AxisBox from './AxisBox'
import StandardAxisBoxView from './StandardAxisBoxView'
import Lines from './Lines'
import HeightedLegend, { HeightedLegendView } from './HeightedLegend'
import ComparisonLine from './ComparisonLine'
import { HoverTarget } from './Lines'
import Tooltip from './Tooltip'
import DataKey from './DataKey'
import NoData from './NoData'
import { formatYear } from './Util'

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
export default class LineChart extends React.Component<{ bounds: Bounds, chart: ChartConfig }> {
    base: React.RefObject<SVGGElement> = React.createRef()

    @computed get chart() { return this.props.chart }
    @computed get bounds() { return this.props.bounds }
    @computed get transform() { return this.props.chart.lineChart }

    // Order of the legend items on a line chart should visually correspond
    // to the order of the lines as the approach the legend
    @computed get legendItems() {
        // Only show projection legends if there are any projections
        // Bit of a hack
        let toShow = this.transform.groupedData
        if (toShow.some(g => !!g.isProjection))
            toShow = this.transform.groupedData.filter(g => g.isProjection)

        return toShow.map(d => ({
            color: d.color,
            key: d.key,
            label: this.chart.data.formatKey(d.key),
            yValue: (last(d.values) as LineChartValue).y
        }))
    }

    @computed get legend(): HeightedLegend | undefined {
        if (this.chart.hideLegend)
            return undefined

        const that = this
        return new HeightedLegend({
            get maxWidth() { return that.bounds.width / 3 },
            get fontSize() { return that.chart.baseFontSize },
            get items() { return that.legendItems }
        })
    }

    @observable hoverTarget?: HoverTarget
    @observable hoverKey?: string
    @action.bound onHoverPoint(target: HoverTarget) {
        this.hoverTarget = target
        this.hoverKey = target.series.key
    }
    @action.bound onHoverStop() {
        this.hoverTarget = undefined
        this.hoverKey = undefined
    }

    @computed get focusKeys(): DataKey[] {
        return this.hoverKey ? [this.hoverKey] : this.chart.data.selectedKeys
    }

    @computed get tooltip() {
        const { hoverTarget, chart } = this
        if (hoverTarget === undefined) return

        return <Tooltip x={hoverTarget.pos.x} y={hoverTarget.pos.y} style={{ textAlign: "center" }}>
            <h3 style={{ padding: "0.3em 0.9em", margin: 0, backgroundColor: "#fcfcfc", borderBottom: "1px solid #ebebeb", fontWeight: "normal", fontSize: "1em" }}>{chart.data.formatKey(hoverTarget.series.key)}</h3>
            <p style={{ margin: 0, padding: "0.3em 0.9em", fontSize: "0.8em" }}>
                <span>{hoverTarget.series.formatValue(hoverTarget.value.y)}</span><br />
                in<br />
                <span>{formatYear(hoverTarget.value.x)}</span>
            </p>
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

    @action.bound onLegendClick(datakey: string) {
        if (this.chart.addCountryMode === 'add-country') {
            this.chart.data.toggleKey(datakey)
            this.onLegendMouseLeave()
        }
    }

    @action.bound onLegendMouseOver(datakey: string) {
        this.hoverKey = datakey
    }

    @action.bound onLegendMouseLeave() {
        this.hoverKey = undefined
    }

    componentDidMount() {
        // Fancy intro animation

        const base = select(this.base.current)
        base.selectAll("clipPath > rect")
            .attr("width", 0)
            .transition()
            .duration(800)
            .ease(easeLinear)
            .attr("width", this.bounds.width)
            .on("end", () => this.forceUpdate()) // Important in case bounds changes during transition
    }

    @computed get renderUid(): number {
        return guid()
    }

    render() {
        if (this.transform.failMessage)
            return <NoData bounds={this.props.bounds} message={this.transform.failMessage} />

        const { chart, transform, bounds, legend, tooltip, focusKeys, axisBox, renderUid } = this
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
                {chart.comparisonLine && <ComparisonLine axisBox={axisBox} comparisonLine={chart.comparisonLine} />}
                {legend && <HeightedLegendView x={bounds.right - legend.width} legend={legend} focusKeys={focusKeys} yScale={axisBox.yScale} onClick={this.onLegendClick} onMouseOver={this.onLegendMouseOver} onMouseLeave={this.onLegendMouseLeave}/>}
                <Lines xScale={axisBox.xScale} yScale={axisBox.yScale} data={groupedData} onHoverPoint={this.onHoverPoint} onHoverStop={this.onHoverStop} focusKeys={focusKeys} />
            </g>
            {/*hoverTarget && <AxisBoxHighlight axisBox={axisBox} value={hoverTarget.value}/>*/}
            {tooltip}
        </g>
    }
}
