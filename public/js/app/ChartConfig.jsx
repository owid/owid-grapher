// @flow

// In-progress model layer that will eventually replace ChartModel
export default class ChartConfig {
	model: any

	constructor(model) {
		this.model = model
	}

	get title() : string { return this.model.get('title') }
	set title(value : string) { this.model.set('title', value) }

	get subtitle() : string { return this.model.get('subtitle') }
	set subtitle(value : string) { this.model.set('subtitle', value) }

	get type() : string { return this.model.get('chart-type') }
	set type(value : string) { this.model.set('chart-type', value) }

	get sourceDesc() : string { return this.model.get('sourceDesc') }
	set sourceDesc(value : string) { this.model.set('sourceDesc', value) }

	get note() : string { return this.model.get('chart-description') }
	set note(value : string) { this.model.set('chart-description', value) }

	get internalNotes() : string { return this.model.get('internalNotes') }
	set internalNotes(value : string) { this.model.set('internalNotes', value) }
}