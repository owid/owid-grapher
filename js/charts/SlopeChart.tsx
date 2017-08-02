import * as _ from 'lodash'
import * as d3 from 'd3'
import * as React from 'react'
import {observable, computed, asFlat, action, spy} from 'mobx'
import {observer} from 'mobx-react'
import Bounds from './Bounds'
import {bind} from 'decko'
import {getRelativeMouse} from './Util'
import Observations from './Observations'
import ChartConfig from './ChartConfig'
import Text from './Text'
import LabelledSlopes, {SlopeChartSeries} from './LabelledSlopes'
import {DimensionWithData} from './ChartData'

class WrapLayout extends React.Component<{ bounds: Bounds, children: React.ReactNode[], className?: string }> {
	render() {
		let {bounds, children} = this.props
		let x = bounds.x, y = bounds.y, lineHeight = 0

		function layout(width: number, height: number) {
			lineHeight = Math.max(lineHeight, height)

			if (x + width > bounds.right) {
				x = bounds.x
				y += lineHeight
			}

			const childBounds = new Bounds(x, y, width, height)
			x += width
			return childBounds
		}

	    children = _.map(children, (vnode) => {
	    	if (!(vnode as any).nodeName) return vnode
            return React.cloneElement(vnode as any, { layout: layout })
	    })

	    return <g {...(this.props as any)}>
	    	{children}
	    </g>
	}
}

interface ColorLegendItemProps {
	label: string
	color: string
	layout: (x: number, y: number) => Bounds
}

@observer
class ColorLegendItem extends React.Component<ColorLegendItemProps> {
	@computed get rectSize() {
		return 10
	}

	@computed get rectSpacing() {
		return 5
	}

	@computed get textBounds() {
		return Bounds.forText(this.props.label)
	}

	@computed get width() {
		return this.rectSize+this.rectSpacing+this.textBounds.width
	}

	@computed get height() {
		return Math.max(this.rectSize, this.textBounds.height)
	}

	@computed get bounds() {
		return this.props.layout(this.width, this.height)
	}

	render() {
		const {label, color} = this.props
		const {bounds, textBounds, rectSize, rectSpacing} = this

		return <g>
			<rect x={bounds.x} y={bounds.y+(bounds.height/2 - rectSize/2)} width={rectSize} height={rectSize} fill={color}/>
			<text x={bounds.x+rectSize+rectSpacing} y={bounds.y+2.5} dominant-baseline="hanging">{label}</text>
		</g>
	}
}

@observer
class ColorLegend extends React.Component<{ bounds: Bounds, legendData: Object[] }> {
	static calculateBounds(bounds: Bounds) {
		return bounds;
	}

	render() {
		const {bounds, legendData} = this.props

		const rectSize = 10
		const rectSpacing = 5

		return <WrapLayout className="legend" bounds={bounds}>
			{_.map(legendData, (d) => {
				return  <g>
					<rect x={bounds.x} y={bounds.y+(bounds.height/2 - rectSize/2)} width={rectSize} height={rectSize} fill={d.color}/>
			 		<text x={bounds.x+rectSize+rectSpacing} y={bounds.y+2.5} dominant-baseline="hanging">{d.label}</text>
				</g>
			})}
		</WrapLayout>
	}
}

@observer
export default class SlopeChart extends React.Component<{ bounds: Bounds, chart: ChartConfig }> {
	@computed get transform() {
		return this.props.chart.slopeChart
	}

	@computed get legendData() {
		const {colorScale} = this.transform
		return _.map(colorScale.domain(), (d) => {
			return { label: d, color: colorScale(d) }
		})
	}

	render() {
		const {bounds, chart} = this.props
		const {yAxis} = chart
		const {legendData, transform} = this
		const {data} = transform

		return <LabelledSlopes bounds={bounds} yDomain={yAxis.domain} yTickFormat={yAxis.tickFormat} yScaleType={yAxis.scaleType} yScaleTypeOptions={yAxis.scaleTypeOptions} onScaleTypeChange={(scaleType) => { config.yScaleType = scaleType }} data={data}/>
	}
}
