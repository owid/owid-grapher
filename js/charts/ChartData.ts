import * as _ from 'lodash'
import ChartType from './ChartType'
import {computed, autorun, action} from 'mobx'
import ChartConfig, {ChartDimension} from './ChartConfig'
import VariableData, {Variable} from './VariableData'
import DataKey from './DataKey'
import {bind} from 'decko'
import {LineChartSeries} from './LineChart'

interface DataKeyInfo {
	entity: string 
	index: number 
	label: string 
}

export interface SourceWithVariable {
	name: string,
	description: string,
	variable: Variable
}

// A chart dimension plus the variable+data that it requested for itself
export interface FilledDimension extends ChartDimension {
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

	// Make a unique string key for an entity on a variable
	keyFor(entity: string, dimensionIndex: number): DataKey {
		return `${entity}_${dimensionIndex}`
	}

	@computed get filledDimensions(): FilledDimension[] {
        if (!this.vardata.isReady) return []

        return _.map(this.chart.dimensions, dim => {
            const variable = this.vardata.variablesById[dim.variableId]
            return _.extend({}, dim, {
                displayName: dim.displayName || variable.name,
                variable: variable
            })
        })
    }

	@computed get dimensionsByField(): _.Dictionary<FilledDimension> {
		return _.keyBy(this.filledDimensions, 'property')
	}

	@computed get selectedKeys(): DataKey[] {
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
		return _.map(validSelections, sel => this.keyFor(vardata.entityMetaById[sel.entityId].name, sel.index))
	}

	// Map keys back to their components for storage
	set selectedKeys(keys: DataKey[]) {
		const {chart, vardata} = this
		if (!vardata.isReady) return
		
		const colors = new Map()
		_.each(chart.props.selectedData, sel => colors.set(sel.entityId, sel.color))

		const selection = _.map(keys, datakey => {
			const {entity, index} = this.lookupKey(datakey)
			return {
				entityId: vardata.entityMetaByKey[entity].id,
				index: index,
				color: colors.get(datakey)
			}
		})
		chart.props.selectedData = selection
	}

	@computed get selectedKeysByKey(): _.Dictionary<DataKey> {
		return _.keyBy(this.selectedKeys)
	}

	// Calculate the available datakeys and their associated info
	@computed get keyData(): Map<DataKey, DataKeyInfo> {
		const {chart, vardata} = this
		if (!vardata.isReady) return new Map()
		
		const keyData = new Map()
		_.each(chart.primaryDimensions, (dim, index) => {
			const variable = chart.vardata.variablesById[dim.variableId]
			_.each(variable.entitiesUniq, entity => {
				const key = this.keyFor(entity, index)

				keyData.set(key, {
					entity: entity,
					index: index,
					label: chart.primaryDimensions.length > 1 ? `${entity} - ${dim.displayName || variable.name}` : entity
				})
			})
		})

		return keyData
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

	@computed get data() {
		const {chart, vardata} = this
		const {variablesById} = vardata

		if (chart.type == ChartType.ScatterPlot || chart.tab == 'map' || _.isEmpty(variablesById) || _.isEmpty(chart.dimensions))
			return null;

		let result = this.transformDataForLineChart();
		
		/*if (addCountryMode != "add-country" && chartType != ChartType.DiscreteBar) {
			_.each(result.legendData, function(d) {
				d.disabled = !this.chart.isLegendKeyActive(d.key);
			});
			_.each(result.chartData, function(d) {
				d.disabled = !this.chart.isLegendKeyActive(d.key);
			});
		}*/
		chart.colors.assignColorsForLegend(result.legendData);
		chart.colors.assignColorsForChart(result.chartData);		

		return result;		
	}

	@computed get chartData() {		
		return this.data ? this.data.chartData : []
	}

	@computed get legendData() {
		return this.data ? this.data.legendData : []
	}

	@computed get primaryVariable() {
		const yDimension = _.find(this.chart.dimensions, { property: 'y' })
		return yDimension ? this.vardata.variablesById[yDimension.variableId] : undefined
	}


	// Ensures that every series has a value entry for every year in the data
	// Even if that value is just 0
	// Stacked area charts with incomplete data will fail to render otherwise
	/*zeroPadData(chartData) {
		var allYears = {};
		var yearsForSeries = {};

		_.each(chartData, function(series) {
			yearsForSeries[series.id] = {};
			_.each(series.values, function(d, i) {
				allYears[d.x] = true;
				yearsForSeries[series.id][d.x] = true;
			});
		});

		_.each(chartData, function(series) {
			_.each(Object.keys(allYears), function(year) {
				year = parseInt(year);
				if (!yearsForSeries[series.id][year])
					series.values.push({ x: year, y: 0, time: year, fake: true });
			});

			series.values = _.sortBy(series.values, function(d) { return d.x; });
		});

		return chartData;
	}*/

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
