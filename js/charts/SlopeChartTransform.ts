import {computed} from 'mobx'
import * as _ from 'lodash'
import ChartConfig from './ChartConfig'
import Color from './Color'
import DataKey from './DataKey'
import {StackedAreaSeries, StackedAreaValue} from './StackedArea'
import AxisSpec from './AxisSpec'
import {defaultTo} from './Util'
import {DimensionWithData} from './ChartData'
import Observations from './Observations'
import{SlopeChartSeries} from './LabelledSlopes'

// Responsible for translating chart configuration into the form
// of a line chart
export default class SlopeChartTransform {
    chart: ChartConfig

    constructor(chart: ChartConfig) {
        this.chart = chart
    }

	@computed.struct get xDomain() : [number|null, number|null] {
		return this.chart.timeDomain
	}

	@computed.struct get sizeDim(): DimensionWithData {
		return _.find(this.chart.data.filledDimensions, d => d.property == 'size') as DimensionWithData
	}

	@computed.struct get colorDim(): DimensionWithData {
		return _.find(this.chart.data.filledDimensions, d => d.property == 'color') as DimensionWithData
	}

	@computed.struct get yDim(): DimensionWithData {
		return _.find(this.chart.data.filledDimensions, d => d.property == 'y') as DimensionWithData
	}

	@computed get variableData() : Observations {
		const variables = _.map(this.chart.data.filledDimensions, 'variable')
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
		const entityKey = this.chart.vardata.entityMetaByKey

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
}