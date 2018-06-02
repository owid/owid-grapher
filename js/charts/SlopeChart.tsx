import * as React from 'react'
import { intersection, without, uniq, getRelativeMouse } from './Util'
import { observable, computed, action } from 'mobx'
import { observer } from 'mobx-react'
import Bounds from './Bounds'
import ChartConfig from './ChartConfig'
import LabelledSlopes, { SlopeProps } from './LabelledSlopes'
import NoData from './NoData'
import ScatterColorLegend, { ScatterColorLegendView } from './ScatterColorLegend'

@observer
export default class SlopeChart extends React.Component<{ bounds: Bounds, chart: ChartConfig }> {
    // currently hovered individual series key
    @observable hoverKey?: string
    // currently hovered legend color
    @observable hoverColor?: string

    @computed get chart(): ChartConfig {
        return this.props.chart
    }

    @computed get transform() {
        return this.props.chart.slopeChart
    }

    @computed.struct get bounds(): Bounds {
        return this.props.bounds
    }

    @computed get legend(): ScatterColorLegend {
        const that = this
        return new ScatterColorLegend({
            get maxWidth() { return that.sidebarMaxWidth },
            get fontSize() { return that.chart.baseFontSize },
            get colors() { return that.legendColors },
            get scale() { return that.transform.colorScale }
        })
    }

    @action.bound onSlopeMouseOver(slopeProps: SlopeProps) {
        this.hoverKey = slopeProps.key
    }

    @action.bound onSlopeMouseLeave() {
        this.hoverKey = undefined
    }

    @action.bound onLegendMouseOver(color: string) {
        this.hoverKey = undefined
        this.hoverColor = color
    }

    @action.bound onLegendMouseLeave() {
        this.hoverColor = undefined
    }

    // Colors on the legend for which every matching group is focused
    @computed get focusColors(): string[] {
        const {legendColors, transform, chart} = this
        return legendColors.filter(color => {
            const matchingKeys = transform.data.filter(g => g.color === color).map(g => g.key)
            return intersection(matchingKeys, chart.data.selectedKeys).length === matchingKeys.length
        })
    }

    @computed get focusKeys(): string[] {
        return this.chart.data.selectedKeys
    }

    // All currently hovered group keys, combining the legend and the main UI
    @computed get hoverKeys(): string[] {
        const { hoverColor, hoverKey, transform } = this

        const hoverKeys = hoverColor === undefined ? [] : uniq(transform.data.filter(g => g.color === hoverColor).map(g => g.key))

        if (hoverKey !== undefined)
            hoverKeys.push(hoverKey)

        return hoverKeys
    }

    // Colors currently on the chart and not greyed out
    @computed get activeColors(): string[] {
        const {hoverKeys, focusKeys, transform} = this
        const activeKeys = hoverKeys.concat(focusKeys)

        if (activeKeys.length === 0) // No hover or focus means they're all active by default
            return uniq(transform.data.map(g => g.color))
        else
            return uniq(transform.data.filter(g => activeKeys.indexOf(g.key) !== -1).map(g => g.color))
    }

    // Only show colors on legend that are actually in use
    @computed get legendColors() {
        return uniq(this.transform.data.map(g => g.color))
    }

    @computed get sidebarMaxWidth() { return this.bounds.width * 0.5 }
    @computed get sidebarMinWidth() { return 100 }
    @computed.struct get sidebarWidth() {
        const { sidebarMinWidth, sidebarMaxWidth, legend } = this
        return Math.max(Math.min(legend.width, sidebarMaxWidth), sidebarMinWidth)
    }

    render() {
        if (this.transform.failMessage)
            return <NoData bounds={this.props.bounds} message={this.transform.failMessage} />

        const { bounds, chart } = this.props
        const { yAxis } = chart
        const { data } = this.transform
        const { legend, focusKeys, hoverKeys, focusColors, activeColors, sidebarWidth } = this

        return <g>
            <LabelledSlopes bounds={bounds} yDomain={yAxis.domain} yTickFormat={this.transform.yTickFormat} yScaleType={yAxis.scaleType} yScaleTypeOptions={yAxis.scaleTypeOptions} onScaleTypeChange={(scaleType) => { chart.yAxis.scaleType = scaleType }} data={data} fontSize={chart.baseFontSize} focusKeys={focusKeys} hoverKeys={hoverKeys} onMouseOver={this.onSlopeMouseOver} onMouseLeave={this.onSlopeMouseLeave}  />
            <ScatterColorLegendView legend={legend} x={bounds.right - sidebarWidth} y={bounds.top} onMouseOver={this.onLegendMouseOver} onMouseLeave={this.onLegendMouseLeave} focusColors={focusColors} activeColors={activeColors} />
        </g>
    }
}
