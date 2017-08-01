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
import PointsWithLabels from './PointsWithLabels'
import {preInstantiate} from './Util'
import Paragraph from './Paragraph'
import ConnectedScatterLegend from './ConnectedScatterLegend'
import {Triangle} from './Marks'
import ScatterColorLegend from './ScatterColorLegend'
import AxisBox, {AxisBoxView} from './AxisBox'
import ComparisonLine from './ComparisonLine'
import {ScaleType} from './AxisScale'
import AxisSpec from './AxisSpec' 
import {unitFormat} from './Util'

export interface ScatterValue {
    x: number
    y: number
    year: number
    size: number
    time: {[key: string]: number}
}

export interface ScatterSeries {
    key: string
    label: string
    size: number
    color: string
    values: ScatterValue[]
}

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

    @observable focusColor: string|null = null
    @action.bound onLegendMouseOver(color: string) {
        this.focusColor = color
    }

    @action.bound onLegendMouseLeave() {
        this.focusColor = null
    }

    @action.bound onLegendClick() {
        if (this.chart.addCountryMode == 'disabled')
            return
        
        if (_.isEqual(_.sortBy(this.focusKeys), _.sortBy(this.chart.data.selectedKeys)))
            this.chart.data.selectedKeys = []
        else
            this.chart.data.selectedKeys = this.focusKeys
    }

    @computed get focusKeys(): string[] {
        if (this.focusColor) {
            return _.uniq(_.map(_.filter(this.transform.allGroups, series => series.color == this.focusColor), series => series.key))
        } else {
            return this.chart.data.selectedKeys
        }
    }

    @computed get shapeLegend(): ConnectedScatterLegend|undefined {
        const {focusKeys, hoverSeries, sidebarWidth, transform} = this
        const {startYear, endYear} = transform

        if (focusKeys.length || hoverSeries || startYear == endYear)
            return undefined

        return preInstantiate(
            <ConnectedScatterLegend maxWidth={sidebarWidth} startYear={startYear} endYear={endYear}/>
        )
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

        const {transform, bounds, axisBox, chart, timeline, timelineHeight, legend, focusKeys, focusColor, shapeLegend, hoverSeries, sidebarWidth, tooltipSeries, comparisonLine} = this
        const {currentData, sizeDomain} = transform
        return <g className="ScatterPlot">
            <AxisBoxView axisBox={axisBox} onXScaleChange={this.onXScaleChange} onYScaleChange={this.onYScaleChange}/>
            {comparisonLine && <ComparisonLine axisBox={axisBox} comparisonLine={comparisonLine}/>}
            <PointsWithLabels data={currentData} bounds={axisBox.innerBounds} xScale={axisBox.xScale} yScale={axisBox.yScale} sizeDomain={sizeDomain} onSelectEntity={this.onSelectEntity} focusKeys={focusKeys} onMouseOver={this.onScatterMouseOver} onMouseLeave={this.onScatterMouseLeave}/>
            <ScatterColorLegend {...legend.props} x={bounds.right-sidebarWidth} y={bounds.top} onMouseOver={this.onLegendMouseOver} onMouseLeave={this.onLegendMouseLeave} onClick={this.onLegendClick} focusColor={focusColor}/>
            {(shapeLegend || tooltipSeries) && <line x1={bounds.right-sidebarWidth} y1={bounds.top+legend.height+2} x2={bounds.right-5} y2={bounds.top+legend.height+2} stroke="#ccc"/>}
            {shapeLegend && <ConnectedScatterLegend {...shapeLegend.props} x={bounds.right-sidebarWidth} y={bounds.top+legend.height+11}/>}            
            {timeline && <Timeline {...timeline.props}/>}
            {tooltipSeries && <ScatterTooltip series={tooltipSeries} units={chart.units} maxWidth={sidebarWidth} x={bounds.right-sidebarWidth} y={bounds.top+legend.height+11+(shapeLegend ? shapeLegend.height : 0)}/>}
        </g>
    }
}

interface ScatterTooltipProps {
    series: ScatterSeries,
    units: any,
    maxWidth: number,
    x: number,
    y: number
}

@observer
class ScatterTooltip extends React.Component<ScatterTooltipProps> {
    formatValue(value, property) {
        const {units} = this.props
        const unit = _.find(units, { property: property })
        let s = unitFormat(unit, value[property])
        if (value.year != value.time[property])
            s += " (data from " + value.time[property] + ")"
        return s
	}

    render() {
        const {x, y, maxWidth, series} = this.props
        const lineHeight = 5

        const firstValue = _.first(series.values)
        const lastValue = _.last(series.values)
        const values = series.values.length == 1 ? [firstValue] : [firstValue, lastValue]

        const elements = []
        let offset = 0

        const heading = preInstantiate(<Paragraph x={x} y={y+offset} maxWidth={maxWidth} fontSize={0.65}>{series.label}</Paragraph>)
        elements.push(heading)
        offset += heading.height+lineHeight

        _.each(values, v => {
            const year = preInstantiate(<Paragraph x={x} y={y+offset} maxWidth={maxWidth} fontSize={0.55}>{v.year.toString()}</Paragraph>)
            offset += year.height
            const line1 = preInstantiate(<Paragraph x={x} y={y+offset} maxWidth={maxWidth} fontSize={0.45}>{this.formatValue(v, 'y')}</Paragraph>)
            offset += line1.height
            const line2 = preInstantiate(<Paragraph x={x} y={y+offset} maxWidth={maxWidth} fontSize={0.45}>{this.formatValue(v, 'x')}</Paragraph>)
            offset += line2.height+lineHeight            
            elements.push(...[year, line1, line2])
        })

        return <g class="scatterTooltip">
            {_.map(elements, el => el.render())}
        </g>
    }
}