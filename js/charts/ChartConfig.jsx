// @flow

import owid from '../owid'
import _ from 'lodash'
import {observable, computed, action, autorun, toJS} from 'mobx'
import type {ScaleType} from './ScaleSelector'
import ChartData from './ChartData'

// In-progress mobx model layer that will eventually replace ChartModel
export default class ChartConfig {
	@observable.struct selectedEntities = []
    @observable.struct timeRange: [number|null, number|null] = [null, null]
    @observable timeline = null

	model: any

    @action.bound syncFromModel() {
        this.selectedEntities = this.model.getSelectedEntities().map(e => e.name)
        this.timeline = this.model.get('timeline')
        this.timeRange = this.model.get('chart-time')
    }

	constructor(model : any) {
		this.model = model

        this.syncFromModel()
        this.model.on('change', this.syncFromModel)

		autorun(() => {
			const entities = this.selectedEntities
			if (window.chart.vardata) {
				const entityKey = window.chart.vardata.get('entityKey')
                const selectedEntities = _.filter(_.values(entityKey), e => _.includes(entities, e.name))
				this.model.set('selected-countries', selectedEntities)
			}
		})

		autorun(() => {
			this.model.set('timeline', toJS(this.timeline))
		})

        autorun(() => {
            this.model.set('chart-time', toJS(this.timeRange))
        })
	}

	@computed get type() : string { return this.model.get('chart-type') }
	set type(value : string) { this.model.set('chart-type', value) }

	@computed get slug() : string { return this.model.get('slug') }
	set slug(value : string) { this.model.set('slug', value) }

	@computed get title() : string { return this.model.get('title') }
	set title(value : string) { this.model.set('title', value) }

	@computed get subtitle() : string { return this.model.get('subtitle') }
	set subtitle(value : string) { this.model.set('subtitle', value) }

	@computed get sourceDesc() : string { return this.model.get('sourceDesc') }
	set sourceDesc(value : string) { this.model.set('sourceDesc', value) }

	@computed get note() : string { return this.model.get('chart-description') }
	set note(value : string) { this.model.set('chart-description', value) }

	@computed get internalNotes() : string { return this.model.get('internalNotes') }
	set internalNotes(value : string) { this.model.set('internalNotes', value) }

    set timeRange(timeRange: [?number, ?number]) {
        this.model.set('chart-time', timeRange)
    }

	@computed get xAxisConfig() : Object { return this.model.get('x-axis') }
	@computed get yAxisConfig() : Object { return this.model.get('y-axis') }

	@computed get dimensions() : Object[] {
		return this.model.getDimensions()
	}

	@computed get data() : ChartData {
		return new ChartData(this)
	}

	@computed get yDomain() : [number|null, number|null] {
		let min = owid.numeric(this.yAxisConfig["axis-min"])
		let max = owid.numeric(this.yAxisConfig["axis-max"])

		// 0 domain doesn't work with log scale
		if (!_.isFinite(min) || (this.yScaleType == 'log' && min <= 0))
			min = null
		if (!_.isFinite(max) || (this.yScaleType == 'log' && max <= 0))
			max = null

		return [min, max]
	}

	@computed get yScaleType() : ScaleType {
		return this.yAxisConfig['axis-scale'] || 'linear'
	}
	set yScaleType(scaleType : ScaleType) {
		this.model.set('y-axis', _.extend({}, this.model.get('y-axis'), { 'axis-scale': scaleType }))
	}

	@computed get yAxisLabel() : string {
		return this.yAxisConfig['axis-label'] || ""
	}

	@computed get yTickFormat() : (number) => string {
		const yAxis = this.yAxisConfig,
			  yAxisPrefix = yAxis["axis-prefix"] || "",
		   	  yAxisSuffix = yAxis["axis-suffix"] || "",
			  yAxisFormat = yAxis["axis-format"] || 5;

		return (d) => yAxisPrefix + owid.unitFormat({ format: yAxisFormat||5 }, d) + yAxisSuffix;
	}

	@computed get timeDomain() : [number|null, number|null] {
		return this.model.get("chart-time")||[null, null]
	}

	// Tabs that can be navigated to by the user
	@computed get availableTabs() : string[] {
        return _.sortBy(this.model.get('tabs'), function(name) {
            return {
                chart: 1,
                map: 2
            }[name] || 3;
        });
	}

	@computed get yScaleTypeOptions() : ('linear'|'log')[] {
		if (this.model.get('y-axis-scale-selector'))
			return ['linear', 'log']
		else
			return [this.yScaleType]
	}
}
