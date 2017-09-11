import * as _ from 'lodash'
import ChartType from './ChartType'
import {observable, computed, autorun, action} from 'mobx'
import ChartConfig, {ChartDimension} from './ChartConfig'
import VariableData, {Variable} from './VariableData'
import DataKey from './DataKey'
import {bind} from 'decko'
import {LineChartSeries} from './LineChart'
import Color from './Color'
import {formatValue, last, defaultTo, slugify} from './Util'

export interface DataKeyInfo {
	entity: string 
	entityId: number
	dimension: DimensionWithData
	index: number 
	key: string
	fullLabel: string
	label: string 
	shortCode: string
}

export interface SourceWithVariable {
	name: string,
	description: string,
	variable: Variable
}

export class DimensionWithData {
	props: ChartDimension
	@observable.ref index: number
	@observable.ref variable: Variable

	@computed get variableId(): number {
		return this.props.variableId
	}

	@computed get property(): string {
		return this.props.property
	}

	@computed get displayName(): string {
		return defaultTo(this.props.displayName, this.variable.name)
	}

	@computed get unit(): string {
		return defaultTo(this.props.unit, this.variable.unit)
	}

	@computed get isProjection(): boolean {
		return !!this.props.isProjection
	}

	@computed get targetYear(): number|undefined {
		return this.props.targetYear
	}

	@computed get tolerance(): number {
		return this.props.tolerance == null ? 0 : this.props.tolerance
	}

	@computed get shortUnit(): string|undefined {
		const {unit} = this
		const shortUnit = defaultTo(this.props.shortUnit, this.variable.shortUnit)
		
		if (shortUnit) return shortUnit

		if (!unit) return undefined

		if (unit.length < 3)
			return unit
		else {
			const commonShortUnits = ['$', '£', '€', '%']
			if (_.some(commonShortUnits, u => unit[0] == u))
				return unit[0]
			else
				return undefined
		}
	}

	@computed get formatValueShort(): (value: number) => string {
		const {shortUnit} = this
		return value => formatValue(value, { unit: shortUnit })
	}

	@computed get formatValueLong(): (value: number) => string {
		const {unit} = this
		return value => formatValue(value, { unit: unit })
	}

    constructor(index: number, dimension: ChartDimension, variable: Variable) {
		this.index = index
        this.props = dimension
		this.variable = variable
    }
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
		return _.every(chart.dimensions, dim => vardata.variablesById[dim.variableId] !== undefined)
	}

	@computed.struct get filledDimensions(): DimensionWithData[] {
		if (!this.isReady) return []
		
        return _.map(this.chart.dimensions, (dim, i) => {
            const variable = this.vardata.variablesById[dim.variableId]
			return new DimensionWithData(i, dim, variable)
        })
    }

	@computed get primaryDimensions() {
		return this.filledDimensions.filter(dim => dim.property == 'y')        
    }

	@computed get axisDimensions() {
		return this.filledDimensions.filter(dim => dim.property == 'y' || dim.property == 'x')
	}

	@computed get defaultTitle(): string {
		if (this.chart.isScatter)
			return this.axisDimensions.map(d => d.displayName).join(" vs. ")
		else if (this.primaryDimensions.length > 1 && _(this.primaryDimensions).map(d => d.variable.datasetName).uniq().value().length == 1)
			return this.primaryDimensions[0].variable.datasetName
		else if (this.primaryDimensions.length == 2)
			return this.primaryDimensions.map(d => d.displayName).join(" and ")
		else
			return this.primaryDimensions.map(d => d.displayName).join(", ")
	}

	@computed get title(): string {
		return defaultTo(this.chart.props.title, this.defaultTitle)
	}

	@computed get defaultSlug(): string {
		return slugify(this.title)
	}

	@computed get slug(): string {
		return defaultTo(this.chart.props.slug, this.defaultSlug)
	}

    @computed get defaultSourcesLine(): string {
       return _(this.sources).map(source => source.name).uniq().join(", ")
    }

    @computed get sourcesLine(): string {
		return defaultTo(this.chart.props.sourceDesc, this.defaultSourcesLine)
    }

	@computed get isSingleEntity(): boolean {
		return this.vardata.availableEntities.length == 1 || this.chart.addCountryMode == "change-country"
	}

	@computed get isSingleVariable(): boolean {
		return this.primaryDimensions.length == 1
	}

	@computed get isShowingTimeline(): boolean {
		return !!(this.chart.primaryTab == 'map' || (this.chart.isScatter && this.chart.scatter.hasTimeline))
	}

	// Make a unique string key for an entity on a variable
	keyFor(entity: string, dimensionIndex: number): DataKey {
		return `${entity}_${dimensionIndex}`
	}

	@computed get dimensionsByField(): _.Dictionary<DimensionWithData> {
		return _.keyBy(this.filledDimensions, 'property')
	}

	@computed get selectionData(): { key: DataKey, color?: Color }[] {
		const {chart, vardata, primaryDimensions} = this
		let validSelections = chart.props.selectedData.filter(sel => {
			// Must be a dimension that's on the chart
			const dimension = primaryDimensions[sel.index]
			if (dimension == null) return false
			
			// Entity must be within that dimension
			const entityMeta = vardata.entityMetaById[sel.entityId]
			if (entityMeta == null || !_.includes(dimension.variable.entitiesUniq, entityMeta.name)) return false

			// "change entity" charts can only have one entity selected
			if (chart.addCountryMode == "change-country" && sel.entityId != last(chart.props.selectedData).entityId)
				return false

			return true
		})

		validSelections = _.uniqWith(validSelections, (a: any, b: any) => a.entityId == b.entityId && a.index == b.index)

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

	selectKey(key: DataKey) {
		this.selectedKeys = this.selectedKeys.concat([key])
	}

	@computed.struct get keyColors(): {[datakey: string]: Color|undefined}{
		const keyColors: {[datakey: string]: Color|undefined} = {}
		this.selectionData.forEach(d => {
			if (d.color)
				keyColors[d.key] = d.color
		})
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
		const entitiesForDimensions = this.axisDimensions.map(dim => {
			return _(this.availableKeys).map(key => this.lookupKey(key)).filter(d => d.dimension.variableId == dim.variableId).map(d => d.entity).value()
		})

		return _.intersection(...entitiesForDimensions)
	}

	switchEntity(entityId: number) {
        const selectedData = _.cloneDeep(this.chart.props.selectedData)
        selectedData.forEach(d => d.entityId = entityId)
        this.chart.props.selectedData = selectedData		
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

	// Calculate the available datakeys and their associated info
	@computed get keyData(): Map<DataKey, DataKeyInfo> {
		if (!this.isReady) return new Map()
		const {chart, vardata, isSingleEntity, isSingleVariable, primaryDimensions} = this
	
		const keyData = new Map()
		_.each(primaryDimensions, (dim, index) => {
			const {variable} = dim
			_.each(variable.entitiesUniq, entity => {
				const entityMeta = chart.vardata.entityMetaByKey[entity]
				const key = this.keyFor(entity, index)

				// Full label completely represents the data in the key and is used in the editor
				const fullLabel = `${entity} - ${dim.displayName}`

				// The output label however is context-dependent
				let label = fullLabel
				if (isSingleVariable) {
					label = entity
				} else if (isSingleEntity) {
					label = `${dim.displayName}`
				}

				keyData.set(key, {
					key: key,
					entityId: entityMeta.id,
					entity: entity,
					dimension: dim,
					index: index,
					fullLabel: fullLabel,
					label: label,
					shortCode: (primaryDimensions.length > 1 && chart.addCountryMode != "change-country") ? `${entityMeta.code||entityMeta.name}-${dim.index}` : (entityMeta.code||entityMeta.name)
				})
			})
		})

		return keyData
	}

	@computed get canAddData(): boolean {
		return this.chart.addCountryMode == "add-country" && this.availableKeys.length > 1 && !this.chart.isSlopeChart
	}

	@computed get canChangeEntity(): boolean {
		return !this.chart.isScatter && this.chart.addCountryMode == "change-country" && this.availableEntities.length > 1
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
		const {chart, vardata, filledDimensions} = this
		const {variablesById} = vardata

		let sources: SourceWithVariable[] = []
		_.each(filledDimensions, (dim) => {
			const {variable} = dim
			// HACK (Mispy): Ignore the default color source on scatterplots.
			if (variable.name != "Countries Continents" && variable.name != "Total population (Gapminder)")
				sources.push(_.extend({}, variable.source, { variable: variable }))
		});
		return sources
	}
}
