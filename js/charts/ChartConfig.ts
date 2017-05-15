declare function require(name:string): any;
const owid: any = require('../owid').default
import * as _ from 'lodash'
import {observable, computed, action, autorun, toJS} from 'mobx'

// In-progress mobx model layer that will eventually replace ChartModel
export default class ChartConfig {
    @observable.ref type: string
    @observable.ref slug: string
    @observable.ref title: string
    @observable.ref subtitle: string
    @observable.ref sourceDesc: string
    @observable.ref note: string
    @observable.ref internalNotes: string
    @observable.ref logosSVG: string[]
    @observable.ref originUrl: string

	@observable.ref selectedEntities: Object[] = []
    @observable.ref entityType: string = "country"
    @observable.ref timeRange: [number|null, number|null]
    @observable timeline: Object = null

    @observable.ref yAxisConfig: any
    @observable.ref yDomain: [number|null, number|null]
    @observable.ref yScaleType: 'linear'|'log'
    @observable.ref yScaleTypeOptions: string[]
    @observable.ref yAxisLabel: string
    @observable.ref yTickFormat: (v: number) => string

    @observable.ref xAxisConfig: any
    @observable.ref xDomain: [number|null, number|null]
    @observable.ref xScaleType: 'linear'|'log'
    @observable.ref xScaleTypeOptions: string[]
    @observable.ref xAxisLabel: string
    @observable.ref xTickFormat: (v: number) => string
    @observable.struct availableTabs: string[]

	model: any

    @action.bound syncFromModel() {
        this.type = this.model.get('chart-type')
        this.slug = this.model.get('slug')
        this.title = this.model.get('title')
        this.subtitle = this.model.get('subtitle')
        this.sourceDesc = this.model.get('sourceDesc')
        this.note = this.model.get('chart-description')
        this.internalNotes = this.model.get('internalNotes')
        this.logosSVG = this.model.get('logosSVG')
        this.originUrl = this.model.get('data-entry-url')

        this.selectedEntities = this.model.getSelectedEntities().map((e: any) => e.name)
        this.entityType = this.model.get('entity-type')
        this.timeline = this.model.get('timeline')
        this.timeRange = this.model.get('chart-time')||[]

        this.yAxisConfig = this.model.get('y-axis')||{}
        let min = owid.numeric(this.yAxisConfig["axis-min"])
        let max = owid.numeric(this.yAxisConfig["axis-max"])
        // 0 domain doesn't work with log scale
        if (!_.isFinite(min) || (this.yScaleType == 'log' && min <= 0))
            min = null
        if (!_.isFinite(max) || (this.yScaleType == 'log' && max <= 0))
            max = null
        this.yDomain = [min, max]
        this.yScaleType = this.yAxisConfig['axis-scale'] || 'linear'
        this.yScaleTypeOptions = this.model.get('y-axis-scale-selector') ? ['linear', 'log'] : [this.yScaleType]
        this.yAxisLabel = this.yAxisConfig['axis-label'] || ""
        const yAxis = this.yAxisConfig,
              yAxisPrefix = yAxis["axis-prefix"] || "",
              yAxisSuffix = yAxis["axis-suffix"] || "",
              yAxisFormat = yAxis["axis-format"] || 5;
        this.yTickFormat = (d) => yAxisPrefix + owid.unitFormat({ format: yAxisFormat||5 }, d) + yAxisSuffix;

        (() => {
            this.xAxisConfig = this.model.get('x-axis')||{}
            let min = owid.numeric(this.xAxisConfig["axis-min"])
            let max = owid.numeric(this.xAxisConfig["axis-max"])
            // 0 domain doesn't work with log scale
            if (!_.isFinite(min) || (this.xScaleType == 'log' && min <= 0))
                min = null
            if (!_.isFinite(max) || (this.xScaleType == 'log' && max <= 0))
                max = null
            this.xDomain = [min, max]
            this.xScaleType = this.xAxisConfig['axis-scale'] || 'linear'
            this.xScaleTypeOptions = this.model.get('y-axis-scale-selector') ? ['linear', 'log'] : [this.xScaleType]
            this.xAxisLabel = this.xAxisConfig['axis-label'] || ""
            const xAxis = this.xAxisConfig,
                  xAxisPrefix = xAxis["axis-prefix"] || "",
                  xAxisSuffix = xAxis["axis-suffix"] || "",
                  xAxisFormat = xAxis["axis-format"] || 5
            this.xTickFormat = (d) => xAxisPrefix + owid.unitFormat({ format: xAxisFormat||5 }, d) + xAxisSuffix
        })()

        this.availableTabs = _.sortBy(this.model.get('tabs'), name => {
            if (name == 'chart')
                return 1
            else if (name == 'map')
                return 2
            else
                return 3
        })
    }

	constructor(model : any) {
		this.model = model

        this.syncFromModel()
        this.model.on('change', this.syncFromModel)

		/*autorun(() => {
			const entities = this.selectedEntities
			if (window.chart.vardata) {
				const entityKey = window.chart.vardata.get('entityKey')
                if (!_.isEmpty(entityKey)) {
                    const selectedEntities = _.filter(_.values(entityKey), e => _.includes(entities, e.name))
                    this.model.set('selected-countries', selectedEntities)
                }
			}
		})*/

        autorun(() => {
            this.model.set({
                'chart-type': this.type,
                'slug': this.slug,
                'title': this.title,
                'subtitle': this.subtitle,
                'sourceDesc': this.sourceDesc,
                'chart-description': this.note,
                'internalNotes': this.internalNotes
            })
        })

		autorun(() => {
			this.model.set('timeline', toJS(this.timeline))
		})

        autorun(() => {
            this.model.set('chart-time', toJS(this.timeRange))
        })
	}

	@computed get dimensions() : Object[] {
		return this.model.getDimensions()
	}

	@computed get timeDomain() : [number|null, number|null] {
		return this.model.get("chart-time")||[null, null]
	}
}
