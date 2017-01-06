// @flow

import * as _ from '../libs/underscore'
import * as d3 from '../libs/d3.v4'
import owid from '../owid'
import dataflow from './owid.dataflow'
import { h, render, Component } from 'preact'

class Bounds {
	x: number
	y: number
	width: number
	height: number

	constructor(x, y, width, height) {
		this.x = x
		this.y = y
		this.width = width
		this.height = height
	}

	static fromProps(props: { x: number, y: number, width: number, height: number }): Bounds {
		const { x, y, width, height } = props
		return new Bounds(x, y, width, height)
	}	

	static forText(str : string, { fontSize = '1em' }): Bounds {
		let update = d3.select('svg').selectAll('.tmpTextCalc').data([str]);

		let text = update.enter().append('text')
			.attr('class', 'tmpTextCalc')
			.attr('opacity', 0)
			.merge(update)
  			  .attr('font-size', fontSize)
			  .text(function(d) { return d; });

		return Bounds.fromProps(text.node().getBBox())
	}


	get left() { return this.x }
	get top() { return this.y }
	get right() { return this.x+this.width }
	get bottom() { return this.y+this.height }

	padLeft(amount: number): Bounds {
		return new Bounds(this.x+amount, this.y, this.width-amount, this.height)
	}

	padRight(amount: number): Bounds {
		return new Bounds(this.x, this.y, this.width-amount, this.height)
	}

	extend(props: { x?: number, y?: number, width?: number, height?: number }): Bounds {
		return Bounds.fromProps(_.extend({}, this, props))
	}

	intersects(otherBounds: Bounds): boolean {
		const r1 = this, r2 = otherBounds

	    return !(r2.left > r1.right || r2.right < r1.left || 
             r2.top > r1.bottom || r2.bottom < r1.top)
	}
}

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

		return <g className="axis" font-size="0.8em">
					{_.map(ticks, (tick) => {
						if (orient == 'left') {
							return <text x={bounds.left} y={scale(tick)}>{tick}</text>
						} else if (orient == 'right') {
							return <text x={bounds.right} y={scale(tick)} text-anchor="end">{tick}</text>
						}
					})}
  			    </g>		
	}
}

type SVGElement = any;

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

type SlopeProps = {
	x1: number,
	y1: number,
	x2: number,
	y2: number,
	label: string,
	labelFontSize: string,
	leftLabelBounds: Bounds,
	rightLabelBounds: Bounds,
};

class Slope extends Component {
	props: SlopeProps

	render() {
		const { x1, y1, x2, y2, label, labelFontSize, leftLabelBounds, rightLabelBounds } = this.props
		const lineColor = '#89C9CF'
		const labelColor = '#333'

		return <g class="entity">
			{ label ? <text x={leftLabelBounds.x} y={leftLabelBounds.y} font-size={labelFontSize} fill={labelColor}>{label}</text> : '' }
			<circle cx={x1} cy={y1} r='3' fill={lineColor}/>
			<line x1={x1} y1={y1} x2={x2} y2={y2} stroke={lineColor}/>
			<circle cx={x2} cy={y2} r='3' fill={lineColor}/>
			{ label ? <text x={rightLabelBounds.x} y={rightLabelBounds.y} font-size={labelFontSize} fill={labelColor}>{label}</text> : '' }
		</g>
	}
}

	/*	chartTab.flow('yAxisConfig : yDomain, yAxisScale, yAxis, yAxisPrefix, yAxisFormat, yAxisSuffix', function(yDomain, yAxisScale, yAxis, yAxisPrefix, yAxisFormat, yAxisSuffix) {
			return {
				domain: yDomain,
				scaleType: yAxisScale,
				label: yAxis['axis-label'],
				tickFormat: function(d) {
					return yAxisPrefix + owid.unitFormat({ format: yAxisFormat||5 }, d) + yAxisSuffix;							
				}
			};
		});*/

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
		yScale = yScale.range([innerBounds.top, innerBounds.bottom])

		this.xAxes = xAxes
		this.yAxes = yAxes
		this.innerScales = new Scales(xScale, yScale)
		this.innerBounds = innerBounds
	}

	getAxisWidth(yAxis : AxisConfig) {
		return 0
	}
}

class SlopeChart extends Component {
	props: {
		axes: AxisConfig[],
		bounds: Bounds,
		data: { label: string, values: { x: number, y: number }[] }[]
	}

	state: {
		axisLayout: AxisLayout,
		maxLabelWidth: number,
		slopeData: SlopeProps[]
	}

	g: SVGElement

	constructor(props) {
		super()
		this.componentWillReceiveProps(props)
	}

	shouldComponentUpdate(nextProps, nextState) {
		return !_.isEqual(this.props, nextProps) || !_.isEqual(this.state, nextState)
	}

	componentWillReceiveProps(nextProps) {
		const { axes, data, bounds } = nextProps
		const xDomainDefault = d3.extent(_.pluck(_.flatten(_.pluck(data, 'values')), 'x'))
		const yDomainDefault = d3.extent(_.pluck(_.flatten(_.pluck(data, 'values')), 'y'))
		const axisLayout = new AxisLayout(axes, bounds, { xDomainDefault: xDomainDefault, yDomainDefault: yDomainDefault })

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
			const labelBounds = Bounds.forText(series.label, { fontSize: fontSize })

			slopeData.push({ x1: x1, y1: y1, x2: x2, y2: y2, label: series.label,
							 leftLabelBounds: labelBounds, rightLabelBounds: labelBounds,
							 labelFontSize: fontSize })
		})

		// We calc max before doing overlaps because visible labels may change later but
		// layout should remain constant
		const maxLabelWidth = _.max(_.map(slopeData, (slope) => slope.leftLabelBounds.width))

		// Update postioning to account for labels
		_.each(slopeData, (slope) => {			
			slope.x1 += maxLabelWidth
			slope.x2 -= maxLabelWidth
			slope.leftLabelBounds = slope.leftLabelBounds.extend({ x: slope.x1-8-slope.leftLabelBounds.width, y: slope.y1+slope.leftLabelBounds.height/4 })
			slope.rightLabelBounds = slope.rightLabelBounds.extend({ x: slope.x2+8, y: slope.y2+slope.rightLabelBounds.height/4 })		
		})

		// Eliminate overlapping labels
		_.each(slopeData, (s1) => {
			_.each(slopeData, (s2) => {
				if (s1 !== s2 && s1.label && s2.label) {
					const isConflict = (s1.leftLabelBounds.intersects(s2.leftLabelBounds) ||
										s1.rightLabelBounds.intersects(s2.rightLabelBounds))
					if (isConflict)
						delete s2.label					
				}
			})
		})

		// Confine the data to within the specified domain

		this.setState({
			axisLayout: axisLayout,
			slopeData: slopeData,
			maxLabelWidth: maxLabelWidth
		})
	}

    render() {
    	const { bounds } = this.props
    	const { slopeData, maxLabelWidth } = this.state
    	const { innerScales, innerBounds } = this.state.axisLayout

	    return (
	    	<g class="slopeChart" ref={(g) => this.g = g}>
	    		<Axis orient='left' scales={innerScales} bounds={bounds}/>
	    		<Axis orient='right' scales={innerScales} bounds={bounds}/>
	    		{_.map(slopeData, function(slope) {
		    		return <Slope {...slope} />
		    	})}
		    </g>
	    );
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
		let bbounds = new Bounds(bounds.left, bounds.top, bounds.width, bounds.height)
		rootNode = render(<SlopeChart bounds={bbounds} axes={axes} data={data} minYear={minYear} maxYear={maxYear}/>, containerNode, rootNode)
	})

	return slopeChart
}