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
import owid from '../owid'
import ChartConfig from './ChartConfig'
import NoData from './NoData'
import Axis from './Axis'
import AxisScale, {AxisConfig} from './AxisScale'
import Layout from './Layout'
import Timeline from './Timeline'
import PointsWithLabels from './PointsWithLabels'
import {preInstantiate} from './Util'
import Paragraph from './Paragraph'
import ConnectedScatterLegend from './ConnectedScatterLegend'
import {Triangle} from './Marks'
import ScatterData from './ScatterData'
import AxisGrid from './AxisGrid'
import ColorLegend from './ColorLegend'
import AxisBox, {AxisBoxView} from './AxisBox'
import ComparisonLine from './ComparisonLine'
import {ScaleType} from './AxisScale'

type ScatterSeries = any

interface ScatterWithAxisProps {
    bounds: Bounds,
    data: ScatterSeries[],
    xScale: AxisScale,
    yScale: AxisScale,
    xAxisLabel: string,
    yAxisLabel: string
}

@observer
export default class ScatterPlot extends React.Component<{ bounds: Bounds, config: ChartConfig, isStatic: boolean }, undefined> {
    @computed get chart() : ChartConfig {
        return this.props.config
    }

    @computed get data(): ScatterData {
        return new ScatterData(this.chart)
    }

    @computed get bounds() : Bounds {
        return this.props.bounds
    }
    @computed get dimensions() : Object[] {
        return this.chart.dimensionsWithData
    }

    @computed get configTolerance() {
        return 1
    }

    @computed get dataByEntityAndYear() {
        return this.data.dataByEntityAndYear
    }

    @computed get currentData() : ScatterSeries[] {
        const {dataByEntityAndYear, startYear, endYear, isInterpolating} = this
        const {xScaleType, yScaleType, timeline} = this.chart
        var currentData = [];

        _.each(dataByEntityAndYear, (dataByYear) => {
            /*if (!isInterpolating) {
                if (dataByYear[timeline.targetYear])
                    currentData.push(dataByYear[timeline.targetYear]);
                return;
            }*/

            let series = null
            _.each(dataByYear, (seriesForYear, year) => {
                if (year < startYear || year > endYear)
                    return

                series = series || _.extend({}, seriesForYear, { values: [] })
                series.size = _.last(dataByYear[_.last(_.keys(dataByYear))].values).size
                series.values = series.values.concat(seriesForYear.values)
            })
            if (series && series.values.length)
                currentData.push(series)
        });

        currentData = _.map(currentData, series => {
            // Only allow tolerance data to occur once in any given chart (no duplicate data points)
            // Prioritize the start and end years first, then the "true" year
            let values = _.chain(series.values).groupBy(v => v.time.y).map(vals => 
                _.sortBy(vals, v => (v.year == startYear || v.year == endYear) ? -Infinity : Math.abs(v.year-v.time.y))[0]
            ).value()

            values = _.chain(values).groupBy(v => v.time.x).map(vals => { 
                return _.sortBy(vals, v => (v.year == startYear || v.year == endYear) ? -Infinity : Math.abs(v.year-v.time.x))[0]
            }).value()

            // Don't allow values <= 0 for log scales
            values = _.filter(values, v => {
                return (v.y > 0 || yScaleType != 'log') && (v.x > 0 || xScaleType != 'log')
            })

            return _.extend({}, series, {
                values: values
            })
        })

        currentData = _.filter(currentData, series => {
            return series.values.length > 0 && ((_.first(series.values).year == startYear && (_.last(series.values).year == endYear || _.first(series.values).year == startYear)) || _.includes(this.chart.selectedEntities, series.key)
        })

        if (timeline && timeline.compareEndPointsOnly) {
            _.each(currentData, series => {
                series.values = series.values.length == 1 ? series.values : [_.first(series.values), _.last(series.values)]
            })
        }
        
        return currentData;
    }


    @computed get axisDimensions() : Object[] {
        return _.filter(this.dimensions, function(d) { return d.property == 'x' || d.property == 'y'; });
    }

    @computed get yearsWithData() : number[] {
        return this.data.years
    }

    @action.bound onTargetChange({targetStartYear, targetEndYear}: {targetStartYear: number, targetEndYear: number}) {
        this.chart.timeDomain = [targetStartYear, targetEndYear]
    }

    @computed get startYear() {
        if (_.isFinite(this.chart.timeDomain[0]))
            return Math.max(_.first(this.data.years), this.chart.timeDomain[0])
        else
            return _.first(this.data.years)
    }

    @computed get endYear() {
        if (_.isFinite(this.chart.timeDomain[1]))
            return Math.min(_.last(this.data.years), this.chart.timeDomain[1])
        else
            return _.last(this.data.years)
    }

    @computed get allSeries(): Object[] {
        const {dataByEntityAndYear} = this
        return _.flatten(
                  _.map(dataByEntityAndYear, dataByYear =>
                      _.values(dataByYear)
                  )
               )
        
    }

    @computed get allValues() : Object[] {
        const {dataByEntityAndYear} = this
        return _.flatten(_.map(this.allSeries, series => series.values))
    }

    // domains across the entire timeline
    @computed get xDomainDefault() : [number, number] {
        if (this.chart.xScaleType == 'log')
            return d3.extent(_.chain(this.allValues).map('x').filter(v => v > 0).value())
        else
            return d3.extent(_.map(this.allValues, 'x'))
    }

    @computed get xDomain() : [number, number] {
        let xMin = this.chart.xDomain[0]
        let xMax = this.chart.xDomain[1]

        if (this.chart.xScaleType == 'log' && xMin <= 0) xMin = null
        if (this.chart.xScaleType == 'log' && xMax <= 0) xMax = null

        return [
            _.defaultTo(xMin, this.xDomainDefault[0]),
            _.defaultTo(xMax, this.xDomainDefault[1])
        ]
    }

    @computed get yDomainDefault() : [number, number] {
        if (this.chart.yScaleType == 'log')
            return d3.extent(_.chain(this.allValues).map('y').filter(v => v > 0).value())
        else
            return d3.extent(_.map(this.allValues, 'y'))
    }

    @computed get yDomain() : [number, number] {
        let yMin = this.chart.yDomain[0]
        let yMax = this.chart.yDomain[1]

        if (this.chart.yScaleType == 'log' && yMin <= 0) yMin = null
        if (this.chart.yScaleType == 'log' && yMax <= 0) yMax = null
        
        return [
            _.defaultTo(yMin, this.yDomainDefault[0]),
            _.defaultTo(yMax, this.yDomainDefault[1])
        ]    
    }

    @computed get sizeDomain(): [number, number] {
        const sizeValues = _.chain(this.allValues).map('size').filter().value()
        if (sizeValues.length == 0)
            return [1,1]
        else
            return d3.extent(sizeValues)
    }

    @computed get colorsInUse(): string[] {
        return _.uniq(_.map(this.allSeries, 'color'))
    }

    @computed get xAxisConfig(): AxisConfig {
        const {xDomain, chart} = this
        return { 
            scaleType: chart.xScaleType, 
            scaleTypeOptions: chart.xScaleTypeOptions, 
            domain: xDomain, 
            tickFormat: chart.xTickFormat,
            label: chart.xAxisLabel
        }
    }

    @computed get yAxisConfig(): AxisConfig {
        const {yDomain, chart} = this
        return {
            scaleType: chart.yScaleType, 
            scaleTypeOptions: chart.yScaleTypeOptions, 
            domain: yDomain, 
            tickFormat: chart.yTickFormat,
            label: chart.yAxisLabel            
        }
    }

    @action.bound onSelectEntity(focusKeys) {
        if (this.chart.addCountryMode != 'disabled')
            this.chart.selectedEntities = focusKeys
    }

    @computed get timeline(): Timeline|null {
        if (this.props.isStatic || !this.chart.timeline) return null

        const {bounds, yearsWithData, startYear, endYear, onTargetChange} = this
        return preInstantiate(
            <Timeline bounds={bounds.fromBottom(35)} onTargetChange={onTargetChange} years={yearsWithData} startYear={startYear} endYear={endYear}/>
        )
    }

    @computed get timelineHeight(): number {
        return this.timeline ? this.timeline.height : 0
    }

    @computed get legend(): ColorLegend {
        return preInstantiate(<ColorLegend maxWidth={this.sidebarMaxWidth} colors={this.colorsInUse} scale={this.data.colorScale} focusColor={null}/>)
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
        
        if (_.isEqual(_.sortBy(this.focusKeys), _.sortBy(this.chart.selectedEntities)))
            this.chart.selectedEntities = []
        else
            this.chart.selectedEntities = this.focusKeys
    }

    @computed get focusKeys(): string[] {
        if (this.focusColor) {
            return _.uniq(_.map(_.filter(this.allSeries, series => series.color == this.focusColor), series => series.key))
        } else {
            return this.chart.selectedEntities
        }
    }

    @computed get shapeLegend(): ConnectedScatterLegend {
        if (this.focusKeys.length || this.hoverSeries || this.startYear == this.endYear)
            return null

        return preInstantiate(
            <ConnectedScatterLegend maxWidth={this.sidebarWidth} startYear={this.startYear} endYear={this.endYear}/>
        )
    }

    @observable.ref hoverSeries = null
    @action.bound onScatterMouseOver(series: ScatterSeries) {
        this.hoverSeries = series
    }

    @action.bound onScatterMouseLeave() {
        this.hoverSeries = null
    }

    @computed get tooltipSeries() {
        if (this.hoverSeries)
            return this.hoverSeries
        else if (this.focusKeys && this.focusKeys.length == 1)
            return _.find(this.currentData, series => series.key == this.focusKeys[0])
        else
            return null
    }

    @computed get sidebarMaxWidth() { return this.bounds.width*0.5 }
    @computed get sidebarMinWidth() { return 100 }
    @computed get sidebarWidth() {
        const {sidebarMinWidth, sidebarMaxWidth, legend} = this
        return Math.max(Math.min(legend.width, sidebarMaxWidth), sidebarMinWidth)
    }

    @computed get axisBox() {
        const {bounds, xAxisConfig, yAxisConfig, timelineHeight, sidebarWidth} = this
        return new AxisBox({bounds: bounds.padBottom(timelineHeight).padRight(sidebarWidth+20), xAxisConfig, yAxisConfig})        
    }

    @action.bound onYScaleChange(scaleType: ScaleType) {
        this.chart.yScaleType = scaleType
    }

    @action.bound onXScaleChange(scaleType: ScaleType) {
        this.chart.xScaleType = scaleType
    }
    
    @computed get comparisonLine() {
        return this.chart.comparisonLine
    }

    render() {
        if (!this.data.isReady)
            return <NoData bounds={this.bounds}/>

        const {currentData, bounds, yearsWithData, startYear, endYear, axisBox, chart, timeline, timelineHeight, legend, focusKeys, focusColor, shapeLegend, hoverSeries, sidebarWidth, tooltipSeries, sizeDomain, comparisonLine} = this

        return <g className="ScatterPlot">
            <AxisBoxView axisBox={axisBox} onXScaleChange={this.onXScaleChange} onYScaleChange={this.onYScaleChange}/>
            {comparisonLine && <ComparisonLine axisBox={axisBox} comparisonLine={comparisonLine}/>}
            <PointsWithLabels data={currentData} bounds={axisBox.innerBounds} xScale={axisBox.xScale} yScale={axisBox.yScale} sizeDomain={sizeDomain} onSelectEntity={this.onSelectEntity} focusKeys={focusKeys} onMouseOver={this.onScatterMouseOver} onMouseLeave={this.onScatterMouseLeave}/>
            <ColorLegend {...legend.props} x={bounds.right-sidebarWidth} y={bounds.top} onMouseOver={this.onLegendMouseOver} onMouseLeave={this.onLegendMouseLeave} onClick={this.onLegendClick} focusColor={focusColor}/>
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
class ScatterTooltip extends React.Component<ScatterTooltipProps, undefined> {
    formatValue(value, property) {
        const {units} = this.props
        const unit = _.find(units, { property: property })
        let s = owid.unitFormat(unit, value[property])
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