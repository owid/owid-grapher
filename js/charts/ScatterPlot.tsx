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
import AxisScale from './AxisScale'
import Layout from './Layout'
import Timeline from './Timeline'
import PointsWithLabels from './PointsWithLabels'
import {preInstantiate} from './Util'
import Paragraph from './Paragraph'
import ShapeLegend from './ShapeLegend'
import {Triangle} from './Marks'
import ScatterData from './ScatterData'
import AxisGrid from './AxisGrid'

type ScatterSeries = any

interface ColorLegendProps {
    x?: number,
    y?: number,
    maxWidth: number,
    colors: string[],
    scale: d3.ScaleOrdinal<string, string>,
    focusColor?: string,
    onMouseOver: (color: string) => void,
    onClick: (color: string) => void,
    onMouseLeave: () => void
}

interface LabelMark {
    label: Paragraph,
    color: string,
    width: number,
    height: number
}

@observer
class ColorLegend extends React.Component<ColorLegendProps, null> {
    static defaultProps: Partial<ColorLegendProps> = {
        x: 0,
        y: 0,
        onMouseOver: () => null,
        onClick: () => null,
        onMouseLeave: () => null
    }

    @computed get fontSize(): number { return 0.5 }
    @computed get rectSize(): number { return 5 }
    @computed get rectPadding(): number { return 5 }
    @computed get lineHeight(): number { return 5 }

    @computed get labelMarks(): LabelMark[] {
        const {props, fontSize, rectSize, rectPadding} = this

        return _.filter(_.map(props.scale.domain(), value => {            
            const color = props.scale(value)
            if (props.colors.indexOf(color) == -1)
                return null

            const label = preInstantiate(<Paragraph maxWidth={props.maxWidth} fontSize={fontSize}>{value}</Paragraph>)
            return {
                label: label,
                color: color,
                width: rectSize+rectPadding+label.width,
                height: Math.max(label.height, rectSize)
            }
        }))
    }

    @computed get width(): number {
        if (this.labelMarks.length == 0)
            return 0   
        else 
            return _.max(_.map(this.labelMarks, 'width'))
    }

    @computed get height() {
        return _.sum(_.map(this.labelMarks, 'height')) + this.lineHeight*this.labelMarks.length
    }

    render() {
        const {props, rectSize, rectPadding, lineHeight} = this
        let offset = 0

        return <g class="ColorLegend clickable" style={{cursor: 'pointer'}}>
            {_.map(this.labelMarks, mark => {
                const isFocus = mark.color == props.focusColor

                const result = <g class="legendMark" onMouseOver={e => this.props.onMouseOver(mark.color)} onMouseLeave={e => this.props.onMouseLeave()} onClick={e => this.props.onClick(mark.color)}>
                    <rect x={props.x} y={props.y+offset+rectSize/2} width={mark.width} height={mark.height} opacity={0}/>,
                    <rect x={props.x} y={props.y+offset+rectSize/2} width={rectSize} height={rectSize} fill={mark.color} stroke={isFocus && "#FFEC38"}/>,
                    <Paragraph {...mark.label.props} x={props.x+rectSize+rectPadding} y={props.y+offset}/>
                </g>

                offset += mark.height+lineHeight
                return result
            })}
        </g>
    }
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
class ScatterWithAxis extends React.Component<any, null> {
    @action.bound onYScaleChange(scaleType: ScaleType) {
        this.props.chart.yScaleType = scaleType
    }

    @action.bound onXScaleChange(scaleType: ScaleType) {
        this.props.chart.xScaleType = scaleType
    }

    render() {
        const {bounds, xScale, yScale, xAxisLabel, yAxisLabel, data} = this.props

        const xAxisBounds = Axis.calculateBounds(bounds, { orient: 'bottom', scale: xScale, label: xAxisLabel })
        const yAxisBounds = Axis.calculateBounds(bounds, { orient: 'left', scale: yScale, label: yAxisLabel })
        const innerBounds = bounds.padBottom(xAxisBounds.height).padLeft(yAxisBounds.width)

        return <g>
            <Axis orient="left" scale={yScale} labelText={yAxisLabel} bounds={bounds.padBottom(xAxisBounds.height)} onScaleTypeChange={this.onYScaleChange}/>
            <Axis orient="bottom" scale={xScale} labelText={xAxisLabel} bounds={bounds.padLeft(yAxisBounds.width)} onScaleTypeChange={this.onXScaleChange}/>
            <AxisGrid orient="left" scale={yScale} bounds={innerBounds}/>
            <AxisGrid orient="bottom" scale={xScale} bounds={innerBounds}/>
            <PointsWithLabels {...this.props} xScale={xScale} yScale={yScale} data={data} bounds={innerBounds}/>
        </g>
    }
}

@observer
export default class ScatterPlot extends React.Component<{ bounds: Bounds, config: ChartConfig, isStatic: boolean }, null> {
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
        const {xScaleType, yScaleType} = this.chart
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
            return series.values.length > 0 && _.first(series.values).year == startYear && (_.last(series.values).year == endYear || _.first(series.values).year == startYear)
        })
        
        return currentData;
    }


    @computed get axisDimensions() : Object[] {
        return _.filter(this.dimensions, function(d) { return d.property == 'x' || d.property == 'y'; });
    }

    @computed get yearsWithData() : number[] {
        return this.data.years
    }

    @action.bound onTargetChange({targetStartYear, targetEndYear}: {targetStartYear: number, targetEndYear: number}) {
        this.chart.timeRange = [targetStartYear, targetEndYear]
    }

    @computed get startYear() {
        if (_.isFinite(this.chart.timeRange[0]))
            return Math.max(_.first(this.data.years), this.chart.timeRange[0])
        else
            return _.first(this.data.years)
    }

    @computed get endYear() {
        if (_.isFinite(this.chart.timeRange[1]))
            return Math.min(_.last(this.data.years), this.chart.timeRange[1])
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

    @computed get xScale() : AxisScale {
        const {xDomain, chart} = this
        return new AxisScale({ scaleType: chart.xScaleType, scaleTypeOptions: chart.xScaleTypeOptions, domain: xDomain, tickFormat: chart.xTickFormat })
    }

    @computed get yScale() : AxisScale {
        const {yDomain, chart} = this
        return new AxisScale({ scaleType: chart.yScaleType, scaleTypeOptions: chart.yScaleTypeOptions, domain: yDomain, tickFormat: chart.yTickFormat })
    }

    @action.bound onSelectEntity(focusKeys) {
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
        return preInstantiate(<ColorLegend maxWidth={this.sidebarMaxWidth} colors={this.colorsInUse} scale={this.data.colorScale}/>)
    }

    @observable focusColor: string|null = null
    @action.bound onLegendMouseOver(color: string) {
        this.focusColor = color
    }

    @action.bound onLegendMouseLeave() {
        this.focusColor = null
    }

    @action.bound onLegendClick() {
        if (_.isEqual(this.focusKeys, this.chart.selectedEntities))
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

    @computed get shapeLegend(): ShapeLegend {
        if (this.focusKeys.length || this.hoverSeries || this.startYear == this.endYear)
            return null

        const shapeData=[
            {
                shape: <circle cx={3} cy={3} r={2} fill={"#333"} stroke="#ccc" strokeWidth={0.2} opacity={0.8}/>,
                text: this.startYear.toString()
            },
            { 
                shape: <Triangle cx={3} cy={3} r={3} fill={"#333"} stroke="#ccc" strokeWidth={0.2} opacity={1}/>,
                text: this.endYear.toString()
            }
        ]
        return preInstantiate(
            <ShapeLegend maxWidth={this.sidebarWidth} data={shapeData} shapeWidth={6}/>
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

    render() {
        const {currentData, bounds, yearsWithData, startYear, endYear, xScale, yScale, chart, timeline, timelineHeight, legend, focusKeys, focusColor, shapeLegend, hoverSeries, sidebarWidth, tooltipSeries, sizeDomain} = this
        return <g>
            <ScatterWithAxis data={currentData} onMouseOver={this.onScatterMouseOver} chart={chart} bounds={this.bounds.padBottom(timelineHeight).padRight(sidebarWidth+20)} xScale={xScale} yScale={yScale} sizeDomain={sizeDomain} xAxisLabel={chart.xAxisLabel} yAxisLabel={chart.yAxisLabel} onSelectEntity={this.onSelectEntity} focusKeys={focusKeys} onMouseLeave={this.onScatterMouseLeave}/>
            <ColorLegend {...legend.props} x={bounds.right-sidebarWidth} y={bounds.top} onMouseOver={this.onLegendMouseOver} onMouseLeave={this.onLegendMouseLeave} onClick={this.onLegendClick} focusColor={focusColor}/>
            {(shapeLegend || tooltipSeries) && <line x1={bounds.right-sidebarWidth} y1={bounds.top+legend.height+2} x2={bounds.right-5} y2={bounds.top+legend.height+2} stroke="#ccc"/>}
            {shapeLegend && <ShapeLegend {...shapeLegend.props} x={bounds.right-sidebarWidth} y={bounds.top+legend.height+11}/>}            
            {timeline && <Timeline {...timeline.props}/>}
            {tooltipSeries && <ScatterTooltip series={tooltipSeries} units={chart.units} maxWidth={sidebarWidth} x={bounds.right-sidebarWidth} y={bounds.top+legend.height+11+(shapeLegend ? shapeLegend.height : 0)}/>}}
        </g>
    }
}

interface ScatterTooltipProps {
    series: ScatterSeries
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
        const offset = 0

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