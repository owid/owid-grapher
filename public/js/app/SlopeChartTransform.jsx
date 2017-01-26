// @flow

import Observations from './Observations'
import {observable, computed, autorun, asFlat, spy, asStructure} from 'mobx'
import * as d3 from '../libs/d3.v4'
import * as _ from '../libs/underscore'
import owid from '../owid'
import type {SlopeChartSeries} from './SlopeChart'

//spy(function(ev) { console.log(ev); })

export class SlopeChartTransform {
	@observable.struct input = {}
	callback: Function

	constructor() {
		autorun(() => {
			this.output = this.calcOutput
			const {output} = this
			if (this.callback)
				this.callback(output)
		})		
	}

	getProps(opts : { dimensions: Object[], xDomain: [number, number] }, callback : Function) {
		this.callback = callback
		this.input = opts
		return this.output
	}

	@computed get dimensions() : Object[] {
		return this.input.dimensions
	}

	@computed get xDomain() : [number, number] {
		return this.input.xDomain
	}

	@computed get sizeDim() : Object {
		return _.findWhere(this.dimensions, { property: 'size' })||{}
	}

	@computed get colorDim() : Object {
		return _.findWhere(this.dimensions, { property: 'color' })||{}
	}

	@computed get yDim() : Object {
		return _.findWhere(this.dimensions, { property: 'y' })||{}
	}

	@computed get data() : Observations {
		const variables = _.pluck(this.dimensions, 'variable')
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

	@computed get calcOutput() : { data: SlopeChartSeries[] } {
		if (_.isEmpty(this.yDim)) return { data: [] }
		console.log("transform")

		let {data, sizeDim, colorDim, yDim, xDomain} = this
		let [minYear, maxYear] = xDomain
		const entityKey = yDim.variable.entityKey


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

		return { data: data.toArray(), xDomain: [minYear, maxYear] }
	}
}