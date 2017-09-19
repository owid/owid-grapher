/* ScatterPlot.tsx
 * ================
 *
 * Entry point for scatter charts
 *
 * @project Our World In Data
 * @author  Jaiden Mispy
 * @created 2017-03-09
 */

import * as React from 'react'
import {observable, computed, action} from 'mobx'
import {find, includes, uniq} from './Util'
import {observer} from 'mobx-react'
import Bounds from './Bounds'
import ChartConfig from './ChartConfig'
import NoData from './NoData'
import Timeline from './Timeline'
import PointsWithLabels, {ScatterSeries, ScatterValue} from './PointsWithLabels'
import TextWrap from './TextWrap'
import ConnectedScatterLegend from './ConnectedScatterLegend'
import ScatterColorLegend, {ScatterColorLegendView} from './ScatterColorLegend'
import AxisBox, {AxisBoxView} from './AxisBox'
import ComparisonLine from './ComparisonLine'
import {ScaleType} from './AxisScale'
import {formatYear, first, last} from './Util'

@observer
export default class ScatterPlot extends React.Component<{ bounds: Bounds, config: ChartConfig, isStatic: boolean }> {
    @computed get chart() : ChartConfig {
        return this.props.config
    }

    @computed get transform() {
        return this.chart.scatter
    }

    @computed.struct get bounds() : Bounds {
        return this.props.bounds
    }

    @action.bound onTargetChange({targetStartYear, targetEndYear}: {targetStartYear: number, targetEndYear: number}) {
        this.chart.timeDomain = [targetStartYear, targetEndYear]
    }

    @action.bound onSelectEntity(datakey: string) {
        if (this.chart.addCountryMode != 'disabled')
            this.chart.data.toggleKey(datakey)
    }

    @computed get hasTimeline(): boolean {
        return this.transform.hasTimeline && this.transform.timelineYears.length > 0 && !this.props.isStatic
    }

    @computed get timelineHeight(): number {
        return this.hasTimeline ? 35 : 0
    }

    @computed get legend(): ScatterColorLegend {
        const that = this
        return new ScatterColorLegend({
            get maxWidth() { return that.sidebarMaxWidth },
            get colors() { return that.transform.colorsInUse },
            get scale() { return that.transform.colorScale }
        })
    }

    @observable focusColors: string[] = []
    @observable hoverColor: string|undefined
    @action.bound onLegendMouseOver(color: string) {
        this.hoverColor = color
    }

    @action.bound onLegendMouseLeave() {
        this.hoverColor = undefined
    }

    // When the color legend is clicked, toggle selection fo all associated keys
    @action.bound onLegendClick() {
        if (this.chart.addCountryMode == 'disabled')
            return

        if (this.hoverColor) {
            if (this.focusColors.indexOf(this.hoverColor) == -1)
                this.focusColors.push(this.hoverColor)
            else
                this.focusColors = this.focusColors.filter(c => c != this.hoverColor)
        }
    }

    @computed get hoverKeys(): string[] {
        const {hoverColor} = this
        return uniq(this.transform.allGroups.filter(g => hoverColor !== undefined && g.color == hoverColor).map(g => g.key))
    }

    @computed get focusKeys(): string[] {
        const {transform, focusColors} = this
        const focusColorKeys = uniq(transform.allGroups.filter(g => includes(focusColors, g.color)).map(g => g.key))
        return this.chart.data.selectedKeys.concat(focusColorKeys)
    }

    @computed get arrowLegend(): ConnectedScatterLegend|undefined {
        const {transform} = this
        const {startYear, endYear} = transform

        if (startYear == endYear || transform.isRelativeMode)
            return undefined

        const _this = this
        return new ConnectedScatterLegend({
            get maxWidth() { return _this.sidebarWidth },
            get startYear() { return _this.transform.startYear },
            get endYear() { return _this.transform.endYear },
            get endpointsOnly() { return _this.transform.compareEndPointsOnly }
        })
    }

    @observable.ref hoverSeries?: ScatterSeries
    @action.bound onScatterMouseOver(series: ScatterSeries) {
        this.hoverSeries = series
    }

    @action.bound onScatterMouseLeave() {
        this.hoverSeries = undefined
    }

    @computed get tooltipSeries() {
        const {hoverSeries, focusKeys, transform} = this
        if (hoverSeries)
            return hoverSeries
        else if (focusKeys && focusKeys.length == 1)
            return find(transform.currentData, series => series.key == focusKeys[0])
        else
            return null
    }

    @computed get sidebarMaxWidth() { return this.bounds.width*0.5 }
    @computed get sidebarMinWidth() { return 100 }
    @computed.struct get sidebarWidth() {
        const {sidebarMinWidth, sidebarMaxWidth, legend} = this
        return Math.max(Math.min(legend.width, sidebarMaxWidth), sidebarMinWidth)
    }

    @computed get axisBox() {
        const that = this
        return new AxisBox({
            get bounds() { return that.bounds.padBottom(that.timelineHeight).padRight(that.sidebarWidth+20) },
            get xAxis() { return that.transform.xAxis },
            get yAxis() { return that.transform.yAxis }
        })
    }

    @action.bound onYScaleChange(scaleType: ScaleType) {
        this.chart.yAxis.scaleType = scaleType
    }

    @action.bound onXScaleChange(scaleType: ScaleType) {
        this.chart.xAxis.scaleType = scaleType
    }
    
    @computed get comparisonLine() {
        return this.chart.comparisonLine
    }

    @action.bound onTimelineStart() {
        this.transform.useTimelineDomains = true
    }

    @action.bound onTimelineStop() {
        this.transform.useTimelineDomains = false
    }

    @action.bound onToggleEndpoints() {
        this.transform.compareEndPointsOnly = !this.transform.compareEndPointsOnly
    }

    renderInner() {
        if (this.transform.failMessage)
            return <NoData bounds={this.bounds} message={this.transform.failMessage}/>

        const {transform, bounds, axisBox, legend, focusKeys, hoverKeys, focusColors, arrowLegend, sidebarWidth, tooltipSeries, comparisonLine} = this
        const {currentData, sizeDomain} = transform

        return <g>
            <AxisBoxView axisBox={axisBox} onXScaleChange={this.onXScaleChange} onYScaleChange={this.onYScaleChange}/>
            {comparisonLine && <ComparisonLine axisBox={axisBox} comparisonLine={comparisonLine}/>}
            <PointsWithLabels data={currentData} bounds={axisBox.innerBounds} xScale={axisBox.xScale} yScale={axisBox.yScale} sizeDomain={sizeDomain} onSelectEntity={this.onSelectEntity} focusKeys={focusKeys} hoverKeys={hoverKeys} onMouseOver={this.onScatterMouseOver} onMouseLeave={this.onScatterMouseLeave}/>
            <ScatterColorLegendView legend={legend} x={bounds.right-sidebarWidth} y={bounds.top} onMouseOver={this.onLegendMouseOver} onMouseLeave={this.onLegendMouseLeave} onClick={this.onLegendClick} focusColors={focusColors}/>
            {(arrowLegend||tooltipSeries) && <line x1={bounds.right-sidebarWidth} y1={bounds.top+legend.height+2} x2={bounds.right-5} y2={bounds.top+legend.height+2} stroke="#ccc"/>}
            {arrowLegend && <g className="clickable" onClick={this.onToggleEndpoints}>
                {arrowLegend.render(bounds.right-sidebarWidth, bounds.top+legend.height+11)}
            </g>}
            {tooltipSeries && <ScatterTooltip formatY={transform.yFormatTooltip} formatX={transform.xFormatTooltip} series={tooltipSeries} maxWidth={sidebarWidth} x={bounds.right-sidebarWidth} y={bounds.top+legend.height+11+(arrowLegend ? arrowLegend.height+10 : 0)}/>}
        </g>
    }

    renderTimeline(): JSX.Element|undefined {
        const {hasTimeline} = this
        if (!hasTimeline) return undefined

        const {bounds, transform, onTargetChange} = this
        const {timelineYears, startYear, endYear} = transform

        return <Timeline 
            bounds={bounds.fromBottom(35)} 
            onTargetChange={onTargetChange} 
            years={timelineYears} 
            startYear={startYear} 
            endYear={endYear} 
            onStartDrag={this.onTimelineStart} 
            onStopDrag={this.onTimelineStop}/>
    }

    render() {
        return <g className="ScatterPlot">
            {this.renderInner()}
            {this.renderTimeline()}
        </g>
    }
}

interface ScatterTooltipProps {
    formatY: (value: number) => string
    formatX: (value: number) => string
    series: ScatterSeries
    maxWidth: number
    x: number
    y: number
}

@observer
class ScatterTooltip extends React.Component<ScatterTooltipProps> {
    formatValueY(value: ScatterValue) {
        let s = "Y Axis: " + this.props.formatY(value.y)
//        if (value.year != value.time.y)
//            s += " (data from " + value.time.y + ")"
        return s
    }

    formatValueX(value: ScatterValue) {
        let s = "X Axis: " + this.props.formatX(value.x)
        if (!value.time.span && value.time.y != value.time.x)
            s += " (data from " + value.time.x + ")"
        return s
    }

    render() {
        const {x, y, maxWidth, series} = this.props
        const lineHeight = 5

        const firstValue = first(series.values)
        const lastValue = last(series.values)
        const values = series.values.length == 1 ? [firstValue] : [firstValue, lastValue]

        const elements: {x: number, y: number, wrap: TextWrap}[] = []
        let offset = 0

        const heading = { x: x, y: y+offset, wrap: new TextWrap({ maxWidth: maxWidth, fontSize: 0.75, text: series.label }) }
        elements.push(heading)
        offset += heading.wrap.height+lineHeight

        values.forEach(v => {
            const year = { x: x, y: y+offset, wrap: new TextWrap({ maxWidth: maxWidth, fontSize: 0.65, text: v.time.span ? `${formatYear(v.time.span[0])} to ${formatYear(v.time.span[1])}` : formatYear(v.time.y) }) }
            offset += year.wrap.height
            const line1 = { x: x, y: y+offset, wrap: new TextWrap({ maxWidth: maxWidth, fontSize: 0.55, text: this.formatValueY(v)}) }
            offset += line1.wrap.height
            const line2 = { x: x, y: y+offset, wrap: new TextWrap({ maxWidth: maxWidth, fontSize: 0.55, text: this.formatValueX(v)}) }
            offset += line2.wrap.height+lineHeight
            elements.push(...[year, line1, line2])
        })

        return <g className="scatterTooltip">
            {elements.map(el => el.wrap.render(el.x, el.y))}
         </g>
     }
 }
