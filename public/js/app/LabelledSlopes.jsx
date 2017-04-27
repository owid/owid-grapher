/* LabelledSlopes.jsx
 * ================
 *
 * Decoupled view component that does the bulk rendering work for slope charts.
 *
 * @project Our World In Data
 * @author  Jaiden Mispy
 * @created 2017-02-11
 */

// @flow

import * as _ from 'underscore'
import * as d3 from 'd3'
import React, { Component } from 'react'
import {observable, computed, action} from 'mobx'
import {observer} from 'mobx-react'
import {bind} from 'decko'

import type {SVGElement} from './Util'
import type {ScaleType} from './ScaleSelector'
import Bounds from './Bounds'
import Text from './Text'
import Paragraph from './Paragraph'
import NoData from './NoData'
import ScaleSelector from './ScaleSelector'

export type SlopeChartSeries = {
	label: string,
	key: string,
	color: string,
	size: number,
	values: { x: number, y: number }[]
};

type AxisProps = {
	bounds: Bounds,
	orient: 'left' | 'right' | 'bottom',
	tickFormat: (number) => string,
	scale: any,
	scaleType: ScaleType
};

@observer
class Axis extends Component {
	static calculateBounds(containerBounds : Bounds, props : any) {
		const {orient, scale} = props

//		if (orient == 'left' || orient == 'right') {
			const longestTick = _.sortBy(_.map(scale.ticks(6), props.tickFormat), (tick) => -tick.length)[0]
			const axisWidth = Bounds.forText(longestTick).width
			if (orient == "left")
				return new Bounds(containerBounds.x, containerBounds.y, axisWidth, containerBounds.height)
			else
				return new Bounds(containerBounds.x+(containerBounds.width-axisWidth), containerBounds.y, axisWidth, containerBounds.height)
//		} else {
//			return new Bounds(containerBounds.x, containerBounds.y, 0, containerBounds.height)
//		}
	}

	static getTicks(scale, scaleType : ScaleType) {
		if (scaleType == 'log') {
			let minPower10 = Math.ceil(Math.log(scale.domain()[0]) / Math.log(10));
			if (!_.isFinite(minPower10)) minPower10 = 0
			let maxPower10 = Math.floor(Math.log(scale.domain()[1]) / Math.log(10));
			if (maxPower10 <= minPower10) maxPower10 += 1

			var tickValues = [];
			for (var i = minPower10; i <= maxPower10; i++) {
				tickValues.push(Math.pow(10, i));
			}
			return tickValues
		} else {
			return scale.ticks(6)
		}
	}

	props: AxisProps

	@computed get ticks() {
		return Axis.getTicks(this.props.scale, this.props.scaleType)
	}

	render() {
		const {bounds, scale, orient, tickFormat} = this.props
		const {ticks} = this
		const textColor = '#666'

		return <g className="axis" font-size="0.8em">
			{_.map(ticks, (tick) => {
				if (orient == 'left' || orient == 'right')
					return <text x={orient == 'left' ? bounds.left : bounds.right} y={scale(tick)} fill={textColor} dominant-baseline="middle" text-anchor={orient == 'left' ? 'start' : 'end'}>{tickFormat(tick)}</text>
				else if (orient == 'top' || orient == 'bottom')
					return <text x={scale(tick)} y={orient == 'top' ? bounds.top : bounds.bottom} fill={textColor} dominant-baseline={orient == 'top' ? 'auto' : 'hanging'} text-anchor="middle">{tickFormat(tick)}</text>
			})}
	    </g>
	}
}

export type SlopeProps = {
	x1: number,
	y1: number,
	x2: number,
	y2: number,
	color: string,
	size: number,
	hasLeftLabel: boolean,
	hasRightLabel: boolean,
	labelFontSize: string,
	leftLabelBounds: Bounds,
	rightLabelBounds: Bounds,
	leftValueStr: string,
	rightValueStr: string,
	leftLabel: Object,
	rightLabel: Object,
	isFocused: boolean
};

@observer
class Slope extends Component {
	props: SlopeProps
	line: SVGElement

	render() {
		const { x1, y1, x2, y2, color, size, hasLeftLabel, hasRightLabel, leftValueStr, rightValueStr, leftLabel, rightLabel, labelFontSize, leftLabelBounds, rightLabelBounds, isFocused } = this.props
		const lineColor = color //'#89C9CF'
		const labelColor = '#333'
		const opacity = isFocused ? 1 : 0.5

//		if (hasLeftLabel) owid.boundsDebug(leftLabelBounds);
//		if (hasRightLabel) owid.boundsDebug(rightLabelBounds)

        const leftValueLabelBounds = Bounds.forText(leftValueStr, { fontSize: labelFontSize })
        const rightValueLabelBounds = Bounds.forText(rightValueStr, { fontSize: labelFontSize })

		return <g class="slope">
			{hasLeftLabel && <Paragraph x={leftLabelBounds.x+leftLabelBounds.width} y={leftLabelBounds.y} text-anchor="end" font-size={labelFontSize} fill={labelColor} font-weight={isFocused&&'bold'}>{leftLabel}</Paragraph>}
			{hasLeftLabel && <Text x={x1-8} y={y1-leftValueLabelBounds.height/2} text-anchor="end" font-size={labelFontSize} fill={labelColor} font-weight={isFocused&&'bold'}>{leftValueStr}</Text>}
			<circle cx={x1} cy={y1} r={isFocused ? 4 : 2} fill={lineColor} opacity={opacity}/>
			<line ref={(el) => this.line = el} x1={x1} y1={y1} x2={x2} y2={y2} stroke={lineColor} stroke-width={isFocused ? 2*size : size} opacity={opacity}/>
			<circle cx={x2} cy={y2} r={isFocused ? 4 : 2} fill={lineColor} opacity={opacity}/>
			{hasRightLabel && <Text x={x2+8} y={y2-rightValueLabelBounds.height/2} text-anchor="start" dominant-baseline="middle" font-size={labelFontSize} fill={labelColor} font-weight={isFocused&&'bold'}>{rightValueStr}</Text>}
			{hasRightLabel && <Paragraph x={rightLabelBounds.x} y={rightLabelBounds.y} text-anchor="start" font-size={labelFontSize} fill={labelColor} font-weight={isFocused&&'bold'}>{rightLabel}</Paragraph>}
		</g>
	}
}

@observer
export default class LabelledSlopes extends Component {
	props: {
		bounds: Bounds,
		data: SlopeChartSeries[],
		yDomain: [number|null, number|null],
		yTickFormat: (number) => string,
		yScaleType: ScaleType,
		yScaleTypeOptions: ScaleType[],
		onScaleTypeChange: (ScaleType) => void
	}

	base: SVGElement
	svg: SVGElement

	@observable focusKey = null

	@computed get data() : Object[] {
		return this.props.data
	}

	@computed get yTickFormat() : (number) => string {
		return this.props.yTickFormat
	}

	@computed get bounds() : Bounds {
		return this.props.bounds
	}

	@computed get isPortrait() : boolean {
		return this.bounds.width < 400
	}

	@computed get xDomainDefault() : [number, number] {
		return d3.extent(_.pluck(_.flatten(_.pluck(this.props.data, 'values')), 'x'))
	}

	@computed get yDomainDefault() : [number, number] {
		return d3.extent(_.filter(_.pluck(_.flatten(_.pluck(this.props.data, 'values')), 'y'), (d) => d > 0 || this.props.yScaleType != 'log'))
	}

	@computed get xDomain() : [number, number] {
		return this.xDomainDefault
	}

	@computed get yDomain() : [number, number] {
		return [
			this.props.yDomain[0] == null ? this.yDomainDefault[0] : this.props.yDomain[0],
		 	this.props.yDomain[1] == null ? this.yDomainDefault[1] : this.props.yDomain[1]
		]
	}

	@computed get sizeScale() : any {
		return d3.scaleLinear().domain(d3.extent(_.pluck(this.props.data, 'size'))).range([1, 4])
	}

	@computed get yScaleConstructor() : any {
		return this.props.yScaleType == 'log' ? d3.scaleLog : d3.scaleLinear
	}

	@computed get yScale() : any {
		return this.yScaleConstructor().domain(this.yDomain).range(this.props.bounds.padBottom(50).yRange())
	}

	@computed get xScale() : any {
		const {bounds, isPortrait, xDomain, yScale} = this
		const padding = isPortrait ? 0 : Axis.calculateBounds(bounds, { orient: 'left', scale: yScale, tickFormat: this.props.yTickFormat }).width
		return d3.scaleLinear().domain(xDomain).range(bounds.padWidth(padding).xRange())
	}

	@computed get colorScale() : any {
        const colorScheme = [ // TODO less ad hoc color scheme (probably would have to annotate the datasets)
                "#5675c1", // Africa
                "#aec7e8", // Antarctica
                "#d14e5b", // Asia
                "#ffd336", // Europe
                "#4d824b", // North America
                "#a652ba", // Oceania
                "#69c487", // South America
                "#ff7f0e", "#1f77b4", "#ffbb78", "#2ca02c", "#98df8a", "#d62728", "#ff9896", "#9467bd", "#c5b0d5", "#8c564b", "c49c94", "e377c2", "f7b6d2", "7f7f7f", "c7c7c7", "bcbd22", "dbdb8d", "17becf", "9edae5", "1f77b4"]

        return d3.scaleOrdinal().domain(_.uniq(_.pluck(this.props.data, 'color'))).range(colorScheme)
	}

	@computed get maxLabelWidth() : number {
		return this.bounds.width/5
	}

	@computed get initialSlopeData() : SlopeProps[] {
		const { data, bounds, isPortrait, xScale, yScale, sizeScale, yTickFormat, maxLabelWidth } = this

		const slopeData = []
		const yDomain = yScale.domain()

		_.each(data, (series) => {
			// Ensure values fit inside the chart
			if (!_.every(series.values, (d) => d.y >= yDomain[0] && d.y <= yDomain[1]))
				return;

			const [ v1, v2 ] = series.values
			const [ x1, x2 ] = [ xScale(v1.x), xScale(v2.x) ]
			const [ y1, y2 ] = [ yScale(v1.y), yScale(v2.y) ]
			const fontSize = (isPortrait ? 0.5 : 0.55) + 'em'
			const leftValueStr = yTickFormat(v1.y)
			const rightValueStr = yTickFormat(v2.y)
			const leftValueWidth = Bounds.forText(leftValueStr, { fontSize: fontSize }).width
			const rightValueWidth = Bounds.forText(rightValueStr, { fontSize: fontSize }).width
			const leftLabel = Paragraph.wrap(series.label, maxLabelWidth, { fontSize: fontSize })
			const rightLabel = Paragraph.wrap(series.label, maxLabelWidth, { fontSize: fontSize })

			slopeData.push({ x1: x1, y1: y1, x2: x2, y2: y2, color: series.color,
							 size: sizeScale(series.size)||1,
							 leftValueStr: leftValueStr, rightValueStr: rightValueStr,
							 leftValueWidth: leftValueWidth, rightValueWidth: rightValueWidth,
							 leftLabel: leftLabel, rightLabel: rightLabel,
							 labelFontSize: fontSize, key: series.key, isFocused: false,
							 hasLeftLabel: true, hasRightLabel: true })
		})

		return slopeData
	}

	@computed get maxValueWidth() : number {
		return _.max(_.map(this.initialSlopeData, (slope) => slope.leftValueWidth))
	}

	// We calc max before doing overlaps because visible labels may change later but
	// layout should remain constant
/*	@computed get maxLabelWidth() : number {
		return _.max(_.map(this.initialSlopeData, (slope) => slope.leftLabelBounds.width))
	}*/

	@computed get labelAccountedSlopeData() {
		const {maxLabelWidth, maxValueWidth, isPortrait} = this

		return _.map(this.initialSlopeData, (slope) => {
			// Squish slopes to make room for labels
			const x1 = slope.x1+maxLabelWidth+maxValueWidth+8
			const x2 = slope.x2-maxLabelWidth-maxValueWidth-8

			// Position the labels
			const leftLabelBounds = new Bounds(x1-slope.leftValueWidth-12-slope.leftLabel.width, slope.y1-slope.leftLabel.height/2, slope.leftLabel.width, slope.leftLabel.height)
			const rightLabelBounds = new Bounds(x2+slope.rightValueWidth+12, slope.y2-slope.rightLabel.height/2, slope.rightLabel.width, slope.rightLabel.height)

			return _.extend({}, slope, {
				x1: x1,
				x2: x2,
				leftLabelBounds: leftLabelBounds,
				rightLabelBounds: rightLabelBounds
			})
		})
	}

	// Get the final slope data with hover focusing and collision detection
	@computed get slopeData() : SlopeProps[] {
		const { focusKey } = this
		let slopeData = this.labelAccountedSlopeData

		slopeData = _.map(slopeData, (slope) => {
			return _.extend({}, slope, {
				isFocused: slope.key == focusKey,
			})
		})

		// How to work out which of two slopes to prioritize for labelling conflicts
		function chooseLabel(s1, s2) {
			if (s1.isFocused && !s2.isFocused) // Focused slopes always have priority
				return s1
			else if (!s1.isFocused && s2.isFocused)
				return s2
			else if (s1.hasLeftLabel && !s2.hasLeftLabel) // Slopes which already have one label are prioritized for the other side
				return s1
			else if (!s1.hasLeftLabel && s2.hasLeftLabel)
				return s2
			else if (s1.size > s2.size) // Larger sizes get the next priority
				return s1
			else if (s2.size > s1.size)
				return s2
			else
				return s1 // Equal priority, just do the first one
		}

		// Eliminate overlapping labels, one pass for each side
		_.each(slopeData, (s1) => {
			_.each(slopeData, (s2) => {
				if (s1 !== s2 && s1.hasLeftLabel && s2.hasLeftLabel && s1.leftLabelBounds.intersects(s2.leftLabelBounds)) {
					if (chooseLabel(s1, s2) == s1)
						s2.hasLeftLabel = false
					else
						s1.hasLeftLabel = false
				}
			})
		})

		_.each(slopeData, (s1) => {
			_.each(slopeData, (s2) => {
				if (s1 !== s2 && s1.hasRightLabel && s2.hasRightLabel && s1.rightLabelBounds.intersects(s2.rightLabelBounds)) {
					if (chooseLabel(s1, s2) == s1)
						s2.hasRightLabel = false
					else
						s1.hasRightLabel = false
				}
			})
		})

		/*d3.selectAll(".boundsDebug").remove()
		_.each(slopeData, (slope) => {
			if (slope.hasRightLabel)
				owid.boundsDebug(slope.rightLabelBounds)
		})*/

		// Order by focus and size for draw order
		slopeData = _.sortBy(slopeData, (slope) => slope.size)
		slopeData = _.sortBy(slopeData, (slope) => slope.isFocused ? 1 : 0)

		return slopeData
	}

	@bind onMouseMove() {
		const mouse = d3.mouse(this.base)
		if (!this.props.bounds.containsPoint(...mouse))
			this.focusKey = null
		else {
			const slope = _.sortBy(this.slopeData, (slope) => {
				const distToLine = Math.abs((slope.y2-slope.y1)*mouse[0] - (slope.x2-slope.x1)*mouse[1] + slope.x2*slope.y1 - slope.y2*slope.x1) / Math.sqrt((slope.y2-slope.y1)**2 + (slope.x2-slope.x1)**2)
				return distToLine
			})[0]
			this.focusKey = slope.key
		}
	}

	componentDidMount() {
		d3.select('html').on('mousemove.slopechart', this.onMouseMove)
		d3.select('html').on('touchmove.slopechart', this.onMouseMove)
		d3.select('html').on('touchstart.slopechart', this.onMouseMove)

		// Nice little intro animation
		d3.select(this.base).select(".slopes").attr('stroke-dasharray', "100%").attr('stroke-dashoffset', "100%").transition().attr('stroke-dashoffset', "0%")
	}

	componentDidUnmount() {
		d3.select('html').on('mousemove.slopechart', null)
		d3.select('html').on('touchmove.slopechart', null)
		d3.select('html').on('touchstart.slopechart', null)
	}

    render() {
    	const { yTickFormat, yScaleType, yScaleTypeOptions, onScaleTypeChange } = this.props
    	const { bounds, slopeData, isPortrait, xDomain, xScale, yScale } = this

    	if (_.isEmpty(slopeData))
    		return <NoData bounds={bounds}/>

    	const {x1, x2} = slopeData[0]
    	const [y1, y2] = yScale.range()

		// hack
		window.chart.tabs.chart.minYear = xDomain[0]
		window.chart.tabs.chart.maxYear = xDomain[1]

	    return (
	    	<g class="slopeChart">
				<g class="gridlines">
					{_.map(Axis.getTicks(yScale, yScaleType), (tick) => {
						return <line x1={x1} y1={yScale(tick)} x2={x2} y2={yScale(tick)} stroke="#eee" stroke-dasharray="3,2"/>
					})}
				</g>
				{!isPortrait && <Axis layout="left" orient="left" tickFormat={yTickFormat} scale={yScale} scaleType={yScaleType} bounds={bounds}/>}
	    		{!isPortrait && <Axis layout="right" orient="right" tickFormat={yTickFormat} scale={yScale} scaleType={yScaleType} bounds={bounds}/>}
	    		<line x1={x1} y1={y1} x2={x1} y2={y2} stroke="#333"/>
	    		<line x1={x2} y1={y1} x2={x2} y2={y2} stroke="#333"/>
	    		{yScaleTypeOptions.length > 1 && <ScaleSelector x={x1+5} y={y2-8} scaleType={yScaleType} scaleTypeOptions={yScaleTypeOptions} onChange={onScaleTypeChange}/>}
	    		<Text x={x1} y={y1+10} text-anchor="middle" dominant-baseline="hanging" fill="#666">{xDomain[0]}</Text>
	    		<Text x={x2} y={y1+10} text-anchor="middle" dominant-baseline="hanging" fill="#666">{xDomain[1]}</Text>
				<g class="slopes">
					{_.map(slopeData, (slope) => {
				    	return <Slope key={slope.key} {...slope} />
			    	})}
				</g>
		    </g>
	    );
	}
}
