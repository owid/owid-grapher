import {extend, some, isString, isNumber, uniq, min, max, keyBy, keys, values, each, map, sortBy} from './Util'
import ChartType from './ChartType'
import ChartConfig from './ChartConfig'
import {observable, computed, autorun, action, reaction} from 'mobx'

declare var Global: { rootUrl: string }

export class Variable {
	@observable.ref id: number
	@observable.ref name: string
	@observable.ref description: string
	@observable.ref unit: string
	@observable.ref shortUnit: string
	@observable.ref coverage: string
	@observable.ref timespan: string
	@observable.ref datasetName: string
	@observable.struct source: {
		name: string,
		description: string
	}
	@observable.ref years: number[]
	@observable.ref entities: string[]
	@observable.ref values: (string|number)[]

	constructor(meta: Partial<Variable>) {
		extend(this, meta)
	}

	@computed get hasNumericValues(): boolean {
		return some(this.values, v => isFinite(v as number))
	}

	@computed get numericValues(): number[] {
		return uniq(sortBy(this.values.filter(v => isNumber(v)))) as number[]
	}	

	@computed get categoricalValues(): string[] {
		return uniq(sortBy(this.values.filter(v => isString(v)))) as string[]
	}

	@computed get hasCategoricalValues(): boolean {
		return some(this.values, v => isString(v))
	}

	@computed get entitiesUniq(): string[] {
		return uniq(this.entities)
	}

	@computed get yearsUniq(): number[] {
		return uniq(this.years)
	}

	@computed get minYear(): number {
		return min(this.yearsUniq) as number
	}

	@computed get maxYear(): number {
		return max(this.yearsUniq) as number
	}

	@computed get minValue(): number {
		return min(this.numericValues) as number
	}

	@computed get maxValue(): number {
		return max(this.numericValues) as number
	}

	@computed get isNumeric(): boolean {
		return this.hasNumericValues && !this.hasCategoricalValues		
	}

	@computed get valueByEntityAndYear(): Map<string, Map<number, (string|number)>> {
        let valueByEntityAndYear = new Map<string, Map<number, (string|number)>>()
		for (let i = 0; i < this.values.length; i++) {
			const entity = this.entities[i]
			const year = this.years[i]
			const value = this.values[i]

			let valueByYear = valueByEntityAndYear.get(entity)
			if (!valueByYear) {
				valueByYear = new Map()
				valueByEntityAndYear.set(entity, valueByYear)
			}
			valueByYear.set(year, value)
		}
		return valueByEntityAndYear
	}
}

interface EntityMeta {
	id: number,
	name: string,
	code: string
}

export default class VariableData {
	chart: ChartConfig
	@observable.ref dataRequest?: Promise<Response>
	@observable.ref variablesById: {[id: number]: Variable} = {}
	@observable.ref entityMetaById: {[id: number]: EntityMeta} = {}

	constructor(chart: ChartConfig) {
		this.chart = chart
		reaction(() => this.variableIds, this.update)
		this.update()
	}

	@computed get variableIds() {
		return this.chart.dimensions.map(d => d.variableId)
	}

	@computed get entityMetaByKey() {
		return keyBy(this.entityMetaById, 'name')
	}

	@computed get cacheTag(): string {
		return this.chart.variableCacheTag || Date.now().toString()
	}

	@computed get availableEntities(): string[] {
		return keys(this.entityMetaByKey)
	}

	@computed get variables(): Variable[] {
		return values(this.variablesById)
	}

	@action.bound update() {
		const {variableIds, cacheTag} = this
		if (variableIds.length == 0) {
			// No data to download
			return
		}

		fetch(Global.rootUrl + "/data/variables/" + variableIds.join("+") + "?v=" + cacheTag)
			.then(response => response.text())
			.then(rawData => this.receiveData(rawData))
	}

	@action.bound receiveData(rawData: string) {
		var lines = rawData.split("\r\n");

		let variablesById: {[id: string]: Variable} = {}
		let entityMetaById: {[key: string]: EntityMeta} = {}

		lines.forEach((line, i) => {
			if (i === 0) { // First line contains the basic variable metadata
				each(JSON.parse(line).variables, (d: any) => {
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
						if (!isNaN(asNumber))
							variable.values.push(asNumber)
						else
							variable.values.push(spl[2]);
					}
				});
			}
		});

		each(variablesById, v => v.entities = map(v.entities, id => entityMetaById[id].name))
		each(entityMetaById, (e, id) => e.id = +id)
		this.variablesById = variablesById
		this.entityMetaById = entityMetaById
	}
}