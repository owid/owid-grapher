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

		return <g className="axis">
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

class Slope extends Component {
	render() {
		const { label, v1, v2, scales } = this.props
		const { xScale, yScale } = scales
		const [ x1, x2 ] = [ xScale(v1.x), xScale(v2.x) ]
		const [ y1, y2 ] = [ yScale(v1.y), yScale(v2.y) ]

		return <g class="entity">
			<AligningText x={x1-5} y={y1} text-anchor="end" font-size="0.8em">{label}</AligningText>
			<circle cx={x1} cy={y1} r='5' fill='black'/>
			<line x1={x1} y1={y1} x2={x2} y2={y2} stroke='black'/>
			<circle cx={x2} cy={y2} r='5' fill='black'/>
			<AligningText x={x2+5} y={y2} text-anchor="start" font-size="0.8em">{label}</AligningText>
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
		return 100
	}
}

class SlopeChart extends Component {
	props: {
		axes: AxisConfig[],
		bounds: Bounds,
		data: any
	}

	state: {
		axisLayout: AxisLayout
	}

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

		this.setState({
			axisLayout: axisLayout
		})
	}

    render() {
    	const { bounds, data } = this.props
    	const { innerScales, innerBounds } = this.state.axisLayout

	    return (
	    	<g class="slopeChart">
	    		<Axis orient='left' scales={innerScales} bounds={bounds}/>
	    		<Axis orient='right' scales={innerScales} bounds={bounds}/>
	    		{_.map(data, function(series) {
		    		return <Slope label={series.label} v1={_.first(series.values)} v2={_.last(series.values)} scales={innerScales} />
		    	})}
		    </g>
	    );
	}

	componentDidMount() {
		this.postRender()
	}

	postRender() {
//		this.setState({ xScale: this.axisBox.axisBox.xAxis.scale, yScale: this.axisBox.axisBox.yAxis.scale })
	}

	componentDidUpdate() {
		this.postRender()
	}
}

export default function() {
	const slopeChart = dataflow()
	let rootNode = null;

	slopeChart.needs('containerNode', 'bounds', 'axes', 'data')

	slopeChart.flow('containerNode, bounds, axes, data', function(containerNode, bounds, axes, data) {
		let bbounds = new Bounds(bounds.left, bounds.top, bounds.width, bounds.height)
		rootNode = render(<SlopeChart bounds={bbounds} axes={axes} data={data}/>, containerNode, rootNode)
	})

	return slopeChart
}