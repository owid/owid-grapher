// @flow

import Observations from './Observations'
import {observable, computed, asFlat} from 'mobx'
import * as d3 from '../libs/d3.v4'
import * as _ from '../libs/underscore'
import owid from '../owid'
import type {SlopeChartSeries} from './SlopeChart'

export class SlopeChartTransform {
	dimensions: Object[]
	xDomain: [number, number]

	getProps(opts: { dimensions: Object[], xDomain: [number, number] }) {
		const {dimensions, xDomain} = opts
		this.dimensions = dimensions
		this.xDomain = xDomain
		return this.output
	}

	@computed get output() : { data: SlopeChartSeries[] } {
		let {dimensions, xDomain} = this
		let [minYear, maxYear] = xDomain

		const variables = _.pluck(dimensions, 'variable')
		let obvs = []
		_.each(variables, (v) => {
			for (var i = 0; i < v.years.length; i++) {
				let d = { year: v.years[i], entity: v.entities[i] }
				d[v.id] = v.values[i]
				obvs.push(d)
			}
		})
		const entityKey = variables[0].entityKey

		const sizeDim = _.findWhere(dimensions, { property: 'size' })||{}
		const colorDim = _.findWhere(dimensions, { property: 'color' })||{}
		const yDim = _.findWhere(dimensions, { property: 'y' })||{}

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

		let data = new Observations(obvs)

		minYear = _.isFinite(minYear) ? minYear : data.minValue('year')
		maxYear = _.isFinite(maxYear) ? maxYear : data.maxValue('year')

		// Make sure we're using time bounds that actually contain data
		const longestRange = data.filter((d) => _.isFinite(d[yDim.variableId]))
			.mergeBy('entity', (rows) => rows.pluck('year'))
			.sortBy((d) => _.last(d)-_.first(d))
			.last()

		minYear = Math.max(minYear, _.first(longestRange))
		maxYear = Math.min(maxYear, _.last(longestRange))

		data = data.mergeBy('entity', (rows : Observations, entity : string) => {
			return {
				label: entityKey[entity].name,
				key: owid.makeSafeForCSS(entityKey[entity].name),
				color: colorScale(rows.first(colorDim.variableId)),
				size: rows.first(sizeDim.variableId),
				values: rows.filter((d) => d.year == minYear || d.year == maxYear).mergeBy('year').map((d) => {
					return {
						x: d.year,
						y: d[yDim.variableId]
					}
				}).toArray()
			}
		}).filter((d) => d.values.length >= 2)

		return { data: data.toArray() }
	}
}