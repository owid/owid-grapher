/* ScatterPlot.tsx
 * ================
 *
 * Entry point for scatter charts
 *
 * @project Our World In Data
 * @author  Jaiden Mispy
 * @created 2017-03-09
 */

import * as _ from 'lodash'
import * as d3 from 'd3'
import * as React from 'react'
import {observable, computed, action, autorun} from 'mobx'
import {observer} from 'mobx-react'
import Bounds from './Bounds'
import ChartConfig from './ChartConfig'
import NoData from './NoData'
import AxisScale from './AxisScale'
import Timeline from './Timeline'
import PointsWithLabels, {ScatterSeries, ScatterValue} from './PointsWithLabels'
import {preInstantiate} from './Util'
import TextWrap from './TextWrap'
import ConnectedScatterLegend from './ConnectedScatterLegend'
import {Triangle} from './Marks'
import ScatterColorLegend from './ScatterColorLegend'
import AxisBox, {AxisBoxView} from './AxisBox'
import ComparisonLine from './ComparisonLine'
import {ScaleType} from './AxisScale'
import AxisSpec from './AxisSpec' 
import {unitFormat, first, last} from './Util'
import AxisBoxHighlight from './AxisBoxHighlight'

interface ScatterWithAxisProps {
    bounds: Bounds,
    data: ScatterSeries[],
    xScale: AxisScale,
    yScale: AxisScale,
    xAxisLabel: string,
    yAxisLabel: string
}

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

    @action.bound onSelectEntity(focusKeys: string[]) {
        if (this.chart.addCountryMode != 'disabled')
            this.chart.data.selectedKeys = focusKeys
    }

    @computed get timeline(): Timeline|null {
        if (this.props.isStatic || !this.chart.timeline) return null

        const {bounds, transform, onTargetChange} = this
        const {availableYears, startYear, endYear} = transform
        return preInstantiate(
            <Timeline bounds={bounds.fromBottom(35)} onTargetChange={onTargetChange} years={availableYears} startYear={startYear} endYear={endYear}/>
        )
    }

    @computed.struct get timelineHeight(): number {
        return this.timeline ? this.timeline.height : 0
    }

    @computed get legend(): ScatterColorLegend {
        return preInstantiate(<ScatterColorLegend maxWidth={this.sidebarMaxWidth} colors={this.transform.colorsInUse} scale={this.transform.colorScale}/>)
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

    @computed get hoverColorKeys(): string[] {
        const {transform, hoverColor, focusColors} = this
        return _(this.transform.allGroups).filter(series => series.color && (series.color == hoverColor || focusColors.indexOf(series.color) != -1)).map(series => series.key).uniq().value()
    }

    @computed get focusKeys(): string[] {
        return this.chart.data.selectedKeys.concat(this.hoverColorKeys)
    }

    @computed get arrowLegend(): ConnectedScatterLegend|undefined {
        const {focusKeys, hoverSeries, sidebarWidth, transform} = this
        const {startYear, endYear} = transform

        if (focusKeys.length || hoverSeries || startYear == endYear || transform.isRelativeMode)
            return undefined

        const _this = this
        return new ConnectedScatterLegend({
            get maxWidth() { return _this.sidebarWidth },
            get startYear() { return _this.transform.startYear },
            get endYear() { return _this.transform.endYear }
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
            return _.find(transform.currentData, series => series.key == focusKeys[0])
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
        const {bounds, transform, timelineHeight, sidebarWidth} = this
        const {xAxis, yAxis} = transform
        return new AxisBox({bounds: bounds.padBottom(timelineHeight).padRight(sidebarWidth+20), xAxis, yAxis})        
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

    render() {
        if (this.transform.failMessage)
            return <NoData bounds={this.bounds} message={this.transform.failMessage}/>

        const {transform, bounds, axisBox, chart, timeline, timelineHeight, legend, focusKeys, hoverColor, arrowLegend, hoverSeries, sidebarWidth, tooltipSeries, comparisonLine} = this
        const {currentData, sizeDomain} = transform
        return <g className="ScatterPlot">
            <AxisBoxView axisBox={axisBox} onXScaleChange={this.onXScaleChange} onYScaleChange={this.onYScaleChange}/>
            {comparisonLine && <ComparisonLine axisBox={axisBox} comparisonLine={comparisonLine}/>}
            <PointsWithLabels data={currentData} bounds={axisBox.innerBounds} xScale={axisBox.xScale} yScale={axisBox.yScale} sizeDomain={sizeDomain} onSelectEntity={this.onSelectEntity} focusKeys={focusKeys} onMouseOver={this.onScatterMouseOver} onMouseLeave={this.onScatterMouseLeave}/>
            <ScatterColorLegend {...legend.props} x={bounds.right-sidebarWidth} y={bounds.top} onMouseOver={this.onLegendMouseOver} onMouseLeave={this.onLegendMouseLeave} onClick={this.onLegendClick} focusColor={hoverColor}/>
            {(arrowLegend||tooltipSeries) && <line x1={bounds.right-sidebarWidth} y1={bounds.top+legend.height+2} x2={bounds.right-5} y2={bounds.top+legend.height+2} stroke="#ccc"/>}
            {arrowLegend && arrowLegend.render(bounds.right-sidebarWidth, bounds.top+legend.height+11)}
            {timeline && <Timeline {...timeline.props}/>}
            {tooltipSeries && <ScatterTooltip series={tooltipSeries} maxWidth={sidebarWidth} x={bounds.right-sidebarWidth} y={bounds.top+legend.height+11+(arrowLegend ? arrowLegend.height : 0)}/>}
        </g>
    }
}

interface ScatterTooltipProps {
    series: ScatterSeries,
    maxWidth: number,
    x: number,
    y: number
}

@observer
class ScatterTooltip extends React.Component<ScatterTooltipProps> {
    formatValue(value, property) {
        let s = value[property].toString()
        if (value.year != value.time[property])
            s += " (data from " + value.time[property] + ")"
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

        const heading = { x: x, y: y+offset, wrap: new TextWrap({ maxWidth: maxWidth, fontSize: 0.65, text: series.label }) }
        elements.push(heading)
        offset += heading.wrap.height+lineHeight

        _.each(values, v => {
            const year = { x: x, y: y+offset, wrap: new TextWrap({ maxWidth: maxWidth, fontSize: 0.55, text: v.year.toString() }) }
            offset += year.wrap.height
            const line1 = { x: x, y: y+offset, wrap: new TextWrap({ maxWidth: maxWidth, fontSize: 0.45, text: this.formatValue(v, 'y')}) }
            offset += line1.wrap.height
            const line2 = { x: x, y: y+offset, wrap: new TextWrap({ maxWidth: maxWidth, fontSize: 0.45, text: this.formatValue(v, 'x')}) }
            offset += line2.wrap.height+lineHeight            
            elements.push(...[year, line1, line2])
        })

        return <g className="scatterTooltip">
            {_.map(elements, el => el.wrap.render(el.x, el.y))}
         </g>
     }
 }
