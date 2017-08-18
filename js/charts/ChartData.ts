import * as _ from 'lodash'
import ChartType from './ChartType'
import {computed, autorun, action} from 'mobx'
import ChartConfig, {ChartDimension} from './ChartConfig'
import VariableData, {Variable} from './VariableData'
import DataKey from './DataKey'
import {bind} from 'decko'
import {LineChartSeries} from './LineChart'
import Color from './Color'

export interface DataKeyInfo {
	entity: string 
	entityId: number
	index: number 
	key: string
	fullLabel: string
	label: string 
}

export interface SourceWithVariable {
	name: string,
	description: string,
	variable: Variable
}

// A chart dimension plus the variable+data that it requested for itself
export interface DimensionWithData extends ChartDimension {
	variable: Variable
}

export default class ChartData {
	chart: ChartConfig

	constructor(chart: ChartConfig) {
		this.chart = chart
	}

	@computed get vardata() {
		return this.chart.vardata
	}

	// ChartData is ready to go iff we have retrieved data for every variable associated with the chart
	@computed get isReady(): boolean {
		const {chart, vardata} = this
		return _.every(chart.dimensions, dim => vardata.variablesById[dim.variableId])
	}

	// Make a unique string key for an entity on a variable
	keyFor(entity: string, dimensionIndex: number): DataKey {
		return `${entity}_${dimensionIndex}`
	}

	@computed get filledDimensions(): DimensionWithData[] {
        return _.map(this.chart.dimensions, dim => {
            const variable = this.vardata.variablesById[dim.variableId]
            return _.extend({}, dim, {
                displayName: dim.displayName || variable.name,
                variable: variable
            })
        })
    }

	@computed get dimensionsByField(): _.Dictionary<DimensionWithData> {
		return _.keyBy(this.filledDimensions, 'property')
	}

	@computed get selectionData(): { key: DataKey, color?: Color }[] {
		const {chart, vardata} = this
		const validSelections = _.filter(chart.props.selectedData, sel => {
			// Must be a dimension that's on the chart
			const dimension = chart.primaryDimensions[sel.index]
			if (dimension == null) return false
			
			// Entity must be within that dimension
			const entityMeta = vardata.entityMetaById[sel.entityId]
			const variable = vardata.variablesById[dimension.variableId]
			if (entityMeta == null || !_.includes(variable.entitiesUniq, entityMeta.name)) return false

			return true
		})
		return _.map(validSelections, sel => {
			return {
				key: this.keyFor(vardata.entityMetaById[sel.entityId].name, sel.index),
				color: sel.color
			}
		})
	}

	@computed get selectedKeys(): DataKey[] {
		return this.selectionData.map(d => d.key)
	}

	@computed get keyColors(): {[datakey: string]: Color|undefined}{
		const keyColors: {[datakey: string]: Color|undefined} = {}
		this.selectionData.forEach(d => keyColors[d.key] = d.color)
		return keyColors
	}

	setKeyColor(datakey: DataKey, color: Color|undefined) {
		const meta = this.lookupKey(datakey)
		const selectedData = _.cloneDeep(this.chart.props.selectedData)
		selectedData.forEach(d => {
			if (d.entityId == meta.entityId && d.index == meta.index) {
				d.color = color
			}
		})
		this.chart.props.selectedData = selectedData
	}

	@computed get selectedEntities(): string[] {
		return _(this.selectedKeys).map(key => this.lookupKey(key).entity).uniq().value()
	}

	@computed get availableEntities(): string[] {
		return _(this.availableKeys).map(key => this.lookupKey(key).entity).uniq().value()
	}

	// Map keys back to their components for storage
	set selectedKeys(keys: DataKey[]) {
		const {chart, vardata} = this
		if (!this.isReady) return

		const selection = _.map(keys, datakey => {
			const {entity, index} = this.lookupKey(datakey)
			return {
				entityId: vardata.entityMetaByKey[entity].id,
				index: index,
				color: this.keyColors[datakey]
			}
		})
		chart.props.selectedData = selection
	}

	@computed get selectedKeysByKey(): _.Dictionary<DataKey> {
		return _.keyBy(this.selectedKeys)
	}

	@computed get isSingleEntity(): boolean {
		return this.vardata.availableEntities.length == 1 || this.chart.addCountryMode != 'add-country'
	}

	@computed get isSingleVariable(): boolean {
		return this.chart.primaryDimensions.length == 1
	}

	// Calculate the available datakeys and their associated info
	@computed get keyData(): Map<DataKey, DataKeyInfo> {
		if (!this.isReady) return new Map()
		const {chart, vardata, isSingleEntity, isSingleVariable} = this
	
		const keyData = new Map()
		_.each(chart.primaryDimensions, (dim, index) => {
			const variable = chart.vardata.variablesById[dim.variableId]
			_.each(variable.entitiesUniq, entity => {
				const entityMeta = chart.vardata.entityMetaByKey[entity]
				const key = this.keyFor(entity, index)

				// Full label completely represents the data in the key and is used in the editor
				const fullLabel = `${entity} - ${dim.displayName || variable.name}`

				// The output label however is context-dependent
				let label = fullLabel
				if (isSingleVariable) {
					label = entity
				} else if (isSingleEntity) {
					label = `${dim.displayName || variable.name}`
				}

				keyData.set(key, {
					key: key,
					entityId: entityMeta.id,
					entity: entity,
					index: index,
					fullLabel: fullLabel,
					label: label,
					shortCode: chart.primaryDimensions.length > 1 ? `${entityMeta.code||entityMeta.name}-${dim.order}` : entityMeta.code
				})
			})
		})

		return keyData
	}

	@computed get canAddData(): boolean {
		return this.chart.addCountryMode == "add-country" && this.availableKeys.length > 1
	}

	@computed get canChangeEntity(): boolean {
		return this.chart.addCountryMode == "change-country" && this.availableEntities.length > 1
	}

	@computed.struct get availableKeys(): DataKey[] {
		return _.sortBy([...this.keyData.keys()])
	}

	@computed.struct get remainingKeys(): DataKey[] {
		const {chart, availableKeys, selectedKeys} = this
		return _.without(availableKeys, ...selectedKeys)
	}

	@computed get availableKeysByEntity(): Map<string, DataKey[]> {
		const keysByEntity = new Map()
		this.keyData.forEach((info, key) => {
			const keys = keysByEntity.get(info.entity) || []
			keys.push(key)
			keysByEntity.set(info.entity, keys)
		})
		return keysByEntity
	}


	lookupKey(key: DataKey) {
		const keyDatum = this.keyData.get(key)
		if (keyDatum !== undefined)
			return keyDatum
		else
			throw new Error(`Unknown data key: ${key}`)		
	}

	formatKey(key: DataKey): string {
		return this.lookupKey(key).label
	}

	toggleKey(key: DataKey) {
		if (_.includes(this.selectedKeys, key)) {
			this.selectedKeys = this.selectedKeys.filter(k => k != key)
		} else {
			this.selectedKeys = this.selectedKeys.concat([key])
		}
	}

	@computed get primaryVariable() {
		const yDimension = _.find(this.chart.dimensions, { property: 'y' })
		return yDimension ? this.vardata.variablesById[yDimension.variableId] : undefined
	}

	@computed get sources(): SourceWithVariable[] {
		const {chart, vardata} = this
		const {dimensions} = chart
		const {variablesById} = vardata

		if (_.isEmpty(variablesById)) return []

		let sources: SourceWithVariable[] = []
		_.each(dimensions, (dim) => {
			const variable = variablesById[dim.variableId]
			// HACK (Mispy): Ignore the default color source on scatterplots.
			if (variable.name != "Countries Continents" && variable.name != "Total population (Gapminder)")
				sources.push(_.extend({}, variable.source, { variable: variable }))
		});
		return sources
	}
}
