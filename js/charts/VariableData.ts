import * as _ from 'lodash'
import * as $ from 'jquery'
import ChartType from './ChartType'
import ChartConfig from './ChartConfig'
import {observable, computed, autorun, action} from 'mobx'
import EntityKey from './EntityKey'


class Variable {
	@observable.ref id: number
	@observable.ref name: string
	@observable.ref description: string
	@observable.ref unit: string
	@observable.struct source: {
		name: string,
		description: string
	}
	@observable.ref years: number[]
	@observable.ref entities: string[]
	@observable.ref values: (string|number)[]

	constructor(meta: Partial<Variable>) {
		_.extend(this, meta)
	}

	@computed get hasNumericValues() {
		return _.some(this.values, v => _.isFinite(v))
	}

	@computed get categoricalValues() {
		return _.sortBy(_.filter(this.values, v => _.isString(v)))
	}

	@computed get hasCategoricalValues() {
		return _.some(this.values, v => _.isString(v))
	}

	@computed get entitiesUniq() {
		return _.uniq(this.entities)
	}

	@computed get yearsUniq() {
		return _.uniq(this.years)
	}

	@computed get minValue() {
		return _.min(this.values)
	}

	@computed get maxValue() {
		return _.max(this.values)
	}

	@computed get isNumeric() {
		return this.hasNumericValues && !this.hasCategoricalValues		
	}
}

interface EntityMeta {
	id: number,
	name: string,
	code: string
}

export default class VariableData {
	chart: ChartConfig
	dataRequest: any
	@observable.ref variablesById: {[id: number]: Variable} = {}
	@observable.ref entityMetaByKey: {[key: string]: EntityMeta} = {}

	constructor(chart: ChartConfig) {
		this.chart = chart

		autorun(() => this.validateEntities())
		this.update()
	}

	@computed get variableIds() {
		return this.chart.dimensions.map(d => d.variableId)
	}

	@computed get cacheTag() {
		return this.chart.variableCacheTag
	}

	@computed get availableEntities() {
		return _.keys(this.entityMetaByKey)
	}

	@computed get isReady() {
		return !this.dataRequest && !_.isEmpty(this.variablesById)
	}

	// When available entities changes, we need to double check that any selection is still appropriate
	validateEntities() {
		const {chart, availableEntities, entityMetaByKey} = this
		if (!this.isReady) return

		let validEntities = chart.selectedEntities.filter(entity => entityMetaByKey[entity])
		if (_.isEmpty(validEntities) && chart.type != ChartType.ScatterPlot && chart.type != ChartType.DiscreteBar && chart.type != ChartType.SlopeChart) {
			// Select a few random ones
			validEntities = _.sampleSize(availableEntities, 3);
		}

		action(() => chart.selectedEntities = validEntities)()
	}

	@computed get remainingEntities() {
		const {chart, availableEntities} = this
		const {selectedEntities} = chart
		return _.intersection(selectedEntities, availableEntities)
	}

	update() {
		const {variableIds, cacheTag} = this
		// If the requested data changes and we're already downloading a previous request, we
		// might as well cancel it since it won't be what we're after
		if (this.dataRequest) {
			this.dataRequest.abort()
			this.dataRequest = null
		}

		if (variableIds.length == 0) {
			// No data to download
			return
		}

		if (cacheTag)
			this.dataRequest = $.get(Global.rootUrl + "/data/variables/" + variableIds.join("+") + "?v=" + cacheTag);
		else {
			// Editor cachebusting
			this.dataRequest = $.get(Global.rootUrl + "/data/variables/" + variableIds.join("+") + "?v=" + Date.now());
		}

		this.dataRequest.done((rawData: string) => {
			this.dataRequest = null
			this.receiveData(rawData)
		})
	}

	receiveData(rawData: string) {
		var lines = rawData.split("\r\n");

		let variablesById: {[id: string]: Variable} = {}
		let entityMetaById: {[key: string]: EntityMeta} = {}

		lines.forEach((line, i) => {
			if (i === 0) { // First line contains the basic variable metadata
				_(JSON.parse(line).variables).each((d: any) => {
					variablesById[d.id] = new Variable(d)
				})
			} else if (i == lines.length-1) { // Final line is entity id => name mapping
				entityMetaById = JSON.parse(line)
			} else {
				const points = line.split(";");
				let variable: Variable;
				points.forEach(function(d, j) {
					if (j === 0) {
						variable = variablesById[d];
					} else {
						var spl = d.split(",");
						variable.years.push(+spl[0]);
						variable.entities.push(spl[1]);
						const asNumber = parseFloat(spl[2])
						if (asNumber.toString() == spl[2])
							variable.values.push(asNumber)
						else
							variable.values.push(spl[2]);
					}
				});
			}
		});

		_.each(variablesById, v => v.entities = _.map(v.entities, id => entityMetaById[id].name))
		this.variablesById = variablesById
		this.entityMetaByKey = _.keyBy(entityMetaById, 'name')
	}
}