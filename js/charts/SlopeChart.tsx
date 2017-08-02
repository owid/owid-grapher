import * as _ from 'lodash'
import * as d3 from 'd3'
import owid from '../owid'
import * as React from 'react'
import {observable, computed, asFlat, action, spy} from 'mobx'
import {observer} from 'mobx-react'
import Bounds from './Bounds'
import {bind} from 'decko'
import {getRelativeMouse} from './Util'
import Layout from './Layout'
import Observations from './Observations'
import ChartConfig from './ChartConfig'
import Text from './Text'
import LabelledSlopes, {SlopeChartSeries} from './LabelledSlopes'
window.Observations = Observations
import {FilledDimension} from './ChartData'

class WrapLayout extends React.Component<{ bounds: Bounds }> {
	render() {
		let {bounds, children} = this.props
		let x = bounds.x, y = bounds.y, lineHeight = 0

		function layout(width, height) {
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
	    	if (!vnode.nodeName) return vnode
            return React.cloneElement(vnode, { layout: layout })
	    })

	    return <g {...this.props}>
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
	static calculateBounds(bounds) {
		return bounds;
	}

	render() {
		const {bounds, legendData} = this.props

		const rectSize = 10
		const rectSpacing = 5

		return <WrapLayout class="legend" bounds={bounds}>
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
	@computed.struct get dimensions() {
		return this.props.chart.data.filledDimensions
	}

	@computed.struct get xDomain() : [number|null, number|null] {
		return this.props.chart.timeDomain
	}

	@computed.struct get sizeDim(): FilledDimension {
		return _.find(this.dimensions, d => d.property == 'size') as FilledDimension
	}

	@computed.struct get colorDim(): FilledDimension {
		return _.find(this.dimensions, d => d.property == 'color') as FilledDimension
	}

	@computed.struct get yDim(): FilledDimension {
		return _.find(this.dimensions, d => d.property == 'y') as FilledDimension
	}

	@computed get variableData() : Observations {
		const variables = _.map(this.dimensions, 'variable')
		let obvs = []
		_.each(variables, (v) => {
			for (var i = 0; i < v.years.length; i++) {
				let d = { year: v.years[i], entity: v.entities[i] }
				d[v.id] = v.values[i]
				obvs.push(d)
			}
		})
		return new Observations(obvs)
	}

	@computed get colorScale() : any {
		const {colorDim} = this

        const colorScheme = [ // TODO less ad hoc color scheme (probably would have to annotate the datasets)
                "#5675c1", // Africa
                "#aec7e8", // Antarctica
                "#d14e5b", // Asia
                "#ffd336", // Europe
                "#4d824b", // North America
                "#a652ba", // Oceania
                "#69c487", // South America
                "#ff7f0e", "#1f77b4", "#ffbb78", "#2ca02c", "#98df8a", "#d62728", "#ff9896", "#9467bd", "#c5b0d5", "#8c564b", "c49c94", "e377c2", "f7b6d2", "7f7f7f", "c7c7c7", "bcbd22", "dbdb8d", "17becf", "9edae5", "1f77b4"]

        const colorScale = d3.scaleOrdinal().range(colorScheme)
        if (colorDim.variable)
	        colorScale.domain(colorDim.variable.categoricalValues)

	    return colorScale
	}

	@computed get data() : SlopeChartSeries[] {
		if (_.isEmpty(this.yDim)) return []
		let {variableData, sizeDim, yDim, xDomain, colorDim, colorScale} = this
		let data = variableData
		const entityKey = yDim.variable.entityKey

		// Make sure we're using time bounds that actually contain data
		const longestRange = data.filter((d) => _.isFinite(d[yDim.variableId]))
			.mergeBy('entity', (rows) => rows.pluck('year'))
			.sortBy((d) => _.last(d)-_.first(d))
			.last()

		const minYear = xDomain[0] == null ? _.first(longestRange) : Math.max(xDomain[0], _.first(longestRange))
		const maxYear = xDomain[1] == null ? _.last(longestRange) : Math.min(xDomain[1], _.last(longestRange))

		data = data.mergeBy('entity', (rows : Observations, entity : string) => {
			return {
				label: entityKey[entity].name,
				key: owid.makeSafeForCSS(entityKey[entity].name),
				color: colorScale(rows.first(colorDim.variableId)),
				size: rows.first(sizeDim.variableId),
				values: rows.filter((d) => _.isFinite(d[yDim.variableId]) && (d.year == minYear || d.year == maxYear)).mergeBy('year').map((d) => {
					return {
						x: d.year,
						y: d[yDim.variableId]
					}
				}).toArray()
			}
		}).filter((d) => d.values.length >= 2)

		return data.toArray()
	}

	@computed get legendData() {
		const {colorScale} = this
		return _.map(colorScale.domain(), (d) => {
			return { label: d, color: colorScale(d) }
		})
	}

	render() {
		const {bounds, chart} = this.props
		const {yAxis} = chart
		const {data, legendData} = this

		return <Layout bounds={bounds}>
			<LabelledSlopes bounds={Layout.bounds} yDomain={yAxis.domain} yTickFormat={yAxis.tickFormat} yScaleType={yAxis.scaleType} yScaleTypeOptions={yAxis.scaleTypeOptions} onScaleTypeChange={(scaleType) => { config.yScaleType = scaleType }} data={data}/>
		</Layout>
	}
}
