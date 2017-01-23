// @flow

import * as _ from '../libs/underscore'
import * as d3 from '../libs/d3.v4'
import owid from '../owid'
import dataflow from './owid.dataflow'
import { h, render, Component } from 'preact'
import { observable, computed, asFlat } from 'mobx'
import Bounds from './Bounds'
import type {SVGElement} from './Util'

class Scales {
	xScale: any
	yScale: any

	constructor(xScale, yScale) {
		this.xScale = xScale
		this.yScale = yScale
	}
}

class Axis extends Component {
	props: {
		bounds: Bounds,
		scales: Scales,
		orient: 'left' | 'right'
	}

	render() {
		const { bounds, scales, orient } = this.props
		const scale = scales.yScale
		const ticks = scale.ticks(6)
		const textColor = '#666'

		return <g className="axis" font-size="0.8em">
					{_.map(ticks, (tick) => {textColor
						return <text x={orient == 'left' ? bounds.left : bounds.right} y={scale(tick)} fill={textColor} dominant-baseline="middle" text-anchor={orient == 'left' ? 'start' : 'end'}>{tick}</text>
					})}
  			    </g>		
	}
}
class AligningText extends Component {
	textNode: SVGElement

	render() {
		return <text ref={(node) => this.textNode = node} {...this.props}>{this.props.children}</text>
	}

	componentDidMount() {
		this.componentDidUpdate()
	}

	componentDidUpdate() {
		d3.select(this.textNode).attr('dy', this.textNode.getBBox().height/4)		
	}
}

type AxisConfig = {	
	orient: 'left' | 'right' | 'top' | 'bottom',
	domain: [number, number],
	scaleType: 'log' | 'linear',
	label: string,
	tickFormat: (number) => string
};

class AxisLayout {
	xAxes: AxisConfig[]
	yAxes: AxisConfig[]
	innerScales: Scales
	bounds: Bounds
	innerBounds: Bounds

	constructor(axes: AxisConfig[], bounds: Bounds, options: { yDomainDefault?: [number, number], xDomainDefault?: [number, number] }) {
		const { xDomainDefault, yDomainDefault } = options

		const xAxes = _.filter(axes, (axis) => axis.orient == 'top' || axis.orient == 'bottom')
		const yAxes = _.filter(axes, (axis) => axis.orient == 'left' || axis.orient == 'right')

		const xScaleType = xAxes.length ? xAxes[0].scaleType : 'linear'
		const yScaleType = yAxes.length ? yAxes[0].scaleType : 'linear'

		let xScale = xScaleType == 'log' ? d3.scaleLog() : d3.scaleLinear()
		let yScale = yScaleType == 'log' ? d3.scaleLog() : d3.scaleLinear()

		xScale = xScale.domain(_.extend([], xDomainDefault, xAxes.length > 0 && xAxes[0].domain))
		yScale = yScale.domain(_.extend([], yDomainDefault, yAxes.length > 0 && yAxes[0].domain))

		let innerBounds = bounds	
		_.each(yAxes, (axis) => {
			const width = this.getAxisWidth(axis)
			if (axis.orient == 'left')
				innerBounds = innerBounds.padLeft(width)
			else if (axis.orient == 'right')
				innerBounds = innerBounds.padRight(width)
		})

		xScale = xScale.range([innerBounds.left, innerBounds.right])
		yScale = yScale.range([innerBounds.bottom, innerBounds.top])

		this.xAxes = xAxes
		this.yAxes = yAxes
		this.innerScales = new Scales(xScale, yScale)
		this.innerBounds = innerBounds
	}

	getAxisWidth(yAxis : AxisConfig) {
		return 0
	}
}

class Gridlines extends Component {
	props: {
		axisLayout: AxisLayout
	}

	render() {
		const { axisLayout } = this.props
		const { innerBounds, innerScales } = axisLayout	
		const { yScale } = innerScales
		const [ x1, x2 ] = [ innerBounds.left, innerBounds.right ]
		const ticks = yScale.ticks()

		return <g class="gridlines">
			{_.map(ticks, (tick) => {
				return <line x1={x1} y1={yScale(tick)} x2={x2} y2={yScale(tick)} stroke="#eee" stroke-dasharray="3,2"/>
			})}
		</g>
	}
}

class SlopeChart extends Component {
	props: {
		axes: AxisConfig[],
		bounds: Bounds,
		data: { label: string, values: { x: number, y: number }[] }[]
	}

	state: {
		focusKey: ?string
	}

	g: SVGElement

	@observable props = asFlat({})
	@observable state = asFlat({})

	@computed get xDomainDefault() : [number, number] {
		return d3.extent(_.pluck(_.flatten(_.pluck(this.props.data, 'values')), 'x'))
	}

	@computed get yDomainDefault() : [number, number] {
		return d3.extent(_.pluck(_.flatten(_.pluck(this.props.data, 'values')), 'y'))
	}

	@computed get axisLayout() : AxisLayout {
		const { axes, data, bounds } = this.props
		const { xDomainDefault, yDomainDefault } = this
		return new AxisLayout(axes, bounds, { xDomainDefault: xDomainDefault, yDomainDefault: yDomainDefault })
	}

	@computed get initialSlopeData() : SlopeProps[] {
		const { axes, data, bounds } = this.props
		const { axisLayout } = this

		const slopeData : SlopeProps[] = []
		const { xScale, yScale } = axisLayout.innerScales
		const yDomain = yScale.domain()

		_.each(data, (series) => {
			if (!_.every(series.values, (d) => d.y >= yDomain[0] && d.y <= yDomain[1]))
				return;

			const [ v1, v2 ] = series.values
			const [ x1, x2 ] = [ xScale(v1.x), xScale(v2.x) ]
			const [ y1, y2 ] = [ yScale(v1.y), yScale(v2.y) ]
			const fontSize = '0.6em'
			const leftLabel = series.label + ' ' + v1.y
			const rightLabel = v2.y + ' ' + series.label
			const leftLabelBounds = Bounds.forText(leftLabel, { fontSize: fontSize })
			const rightLabelBounds = Bounds.forText(rightLabel, { fontSize: fontSize })

			slopeData.push({ x1: x1, y1: y1, x2: x2, y2: y2,
							 leftLabel: leftLabel, rightLabel: rightLabel,
							 leftLabelBounds: leftLabelBounds, rightLabelBounds: rightLabelBounds,
							 labelFontSize: fontSize, key: series.key, isFocused: false,
							 hasLabel: true })
		})

		return slopeData
	}

	// We calc max before doing overlaps because visible labels may change later but
	// layout should remain constant
	@computed get maxLabelWidth() : number {
		return _.max(_.map(this.initialSlopeData, (slope) => slope.leftLabelBounds.width))		
	}

	// Get the final slope data with hover focusing and collision detection
	@computed get slopeData() : SlopeProps[] {
		const { maxLabelWidth } = this
		const { focusKey } = this.state		
		const slopeData = this.initialSlopeData

		// Position lines and labels to account for each other
		_.each(slopeData, (slope) => {
			slope.isFocused = slope.key == focusKey
			slope.x1 += maxLabelWidth
			slope.x2 -= maxLabelWidth
			slope.leftLabelBounds = slope.leftLabelBounds.extend({ x: slope.x1-8-slope.leftLabelBounds.width, y: slope.y1+slope.leftLabelBounds.height/4 })
			slope.rightLabelBounds = slope.rightLabelBounds.extend({ x: slope.x2+8, y: slope.y2+slope.rightLabelBounds.height/4 })		
		})

		// Eliminate overlapping labels
		_.each(slopeData, (s1) => {
			_.each(slopeData, (s2) => {
				if (s1 !== s2 && s1.hasLabel && s2.hasLabel && !s2.isFocused) {
					const isConflict = (s1.leftLabelBounds.intersects(s2.leftLabelBounds) ||
										s1.rightLabelBounds.intersects(s2.rightLabelBounds))
					if (isConflict)
						s2.hasLabel = false
				}
			})
		})

		return slopeData		
	}

	// The bounds for the slope lines themselves, inside the axes and labels
	@computed get slopeBounds() : Bounds {
		const { maxLabelWidth, axisLayout } = this
		const { innerBounds } = axisLayout

		return innerBounds.padLeft(maxLabelWidth).padRight(maxLabelWidth)
	}

    render() {
    	const { bounds } = this.props
    	const { axisLayout, slopeData, slopeBounds } = this
    	const { innerScales } = axisLayout

	    return (
	    	<g class="slopeChart" ref={(g) => this.g = g}>
	    		<Gridlines axisLayout={axisLayout}/>
	    		<Axis orient='left' scales={innerScales} bounds={bounds}/>
	    		<Axis orient='right' scales={innerScales} bounds={bounds}/>
	    		{/*<line x1={slopeBounds.left} y1={slopeBounds.top} x2={slopeBounds.left} y2={slopeBounds.bottom} stroke="black"/>
	    		<line x1={slopeBounds.right} y1={slopeBounds.top} x2={slopeBounds.right} y2={slopeBounds.bottom} stroke="black"/>*/}
	    		{_.map(slopeData, (slope) => {
			    	return <g onMouseEnter={() => this.setState({ focusKey: slope.key })}>
			    		<Slope {...slope} />
			    	</g>
		    	})}
		    </g>
	    );
	}
}

type SlopeProps = {
	x1: number,
	y1: number,
	x2: number,
	y2: number,
	hasLabel: boolean,
	leftLabel: string,
	rightLabel: string,
	labelFontSize: string,
	leftLabelBounds: Bounds,
	rightLabelBounds: Bounds,
	isFocused: boolean
};
	
class Slope extends Component {
	props: SlopeProps

	render() {
		const { x1, y1, x2, y2, hasLabel, leftLabel, rightLabel, labelFontSize, leftLabelBounds, rightLabelBounds, isFocused } = this.props
		const lineColor = '#89C9CF'
		const labelColor = '#333'

		return <g>
			{ hasLabel ? <text x={leftLabelBounds.x} y={leftLabelBounds.y} font-size={labelFontSize} fill={labelColor}>{leftLabel}</text> : '' }
			<circle cx={x1} cy={y1} r={isFocused ? 6 : 3} fill={lineColor}/>
			<line x1={x1} y1={y1} x2={x2} y2={y2} stroke={lineColor} stroke-width={isFocused ? 2 : 1}/>
			<circle cx={x2} cy={y2} r={isFocused ? 6 : 3} fill={lineColor}/>
			{ hasLabel ? <text x={rightLabelBounds.x} y={rightLabelBounds.y} font-size={labelFontSize} fill={labelColor}>{rightLabel}</text> : '' }
		</g>
	}
}

export default function() {
	const slopeChart = dataflow()
	let rootNode = null;

	slopeChart.needs('containerNode', 'bounds', 'axes', 'dimensions')

	slopeChart.flow('data, minYear, maxYear : dimensions', function(dimensions) {
		const dimension = _.findWhere(dimensions, { property: 'y' })
		const { years, entities, values, entityKey } = dimension.variable
		const seriesByEntity = new Map()

		const minYear = _.first(years)
		const maxYear = _.last(years)

		for (let i = 0; i < years.length; i++) {
			const year = years[i]
			const entityId = entities[i]
			const value = values[i]
			const entity = entityKey[entityId]

			if (year != minYear && year != maxYear)
				continue

			const series = seriesByEntity.get(entityId) || {
				label: entity.name,
				key: owid.makeSafeForCSS(entity.name),
				values: []
			}
			seriesByEntity.set(entityId, series)

			series.values.push({
				x: year,
				y: value
			})
		}

		// Filter to remove single points
		const data = _.filter(Array.from(seriesByEntity.values()), (series) => series.values.length >= 2)

		return [data, minYear, maxYear]
	})

	slopeChart.flow('containerNode, bounds, axes, data, minYear, maxYear', function(containerNode, bounds, axes, data, minYear, maxYear) {
		let bbounds = new Bounds(bounds.left, bounds.top, bounds.width, bounds.height).pad(10)
		rootNode = render(<SlopeChart bounds={bbounds} axes={axes} data={data} minYear={minYear} maxYear={maxYear}/>, containerNode, rootNode)
	})

	slopeChart.beforeClean(function() {
		rootNode = render(() => null, slopeChart.containerNode, rootNode);
	});

	return slopeChart
}