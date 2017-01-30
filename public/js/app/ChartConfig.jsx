// @flow

import owid from '../owid'
import {observable, computed, action} from 'mobx'

// In-progress model layer that will eventually replace ChartModel
export default class ChartConfig {
	model: any

	constructor(model : any) {
		this.model = model
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

	@computed get xAxisConfig() : Object { return this.model.get('x-axis') }
	@computed get yAxisConfig() : Object { return this.model.get('y-axis') }

	@computed get yDomain() : [number|null, number|null] {
		return [owid.numeric(this.yAxisConfig["axis-min"]), 
				owid.numeric(this.yAxisConfig["axis-max"])]
	}

	@computed get yScaleType() : 'log' | 'linear' {
		return this.yAxisConfig['axis-scale'] || 'linear'
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
}