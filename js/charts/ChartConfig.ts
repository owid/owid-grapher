declare function require(name:string): any;
const owid: any = require('../owid').default
import * as _ from 'lodash'
import {observable, computed, action, autorun, toJS} from 'mobx'

interface TimelineConfig {
    compareEndPointsOnly: boolean
}

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
    @observable.ref timeDomain: [number|null, number|null]
    @observable.ref timeline: TimelineConfig|null = null

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
    @observable.ref units: Object[]
    @observable.struct availableTabs: string[]

    @observable.struct dimensions: Object[]
    @observable.ref dimensionsWithData: Object[]
    @observable.ref addCountryMode: 'add-country'|'change-country'|'disabled' = 'add-country'

	model: any

    @computed get selectedEntitiesByName() {
        return _.keyBy(this.selectedEntities)
    }

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

        const timeDomain = this.model.get('chart-time')
        if (!timeDomain)
            this.timeDomain = [null, null]
        else
            this.timeDomain = _.map(timeDomain, v => _.isString(v) ? parseInt(v) : v)

        this.units = JSON.parse(this.model.get('units')||"{}")

        this.yAxisConfig = this.model.get('y-axis')||{}
        let min = owid.numeric(this.yAxisConfig["axis-min"])
        let max = owid.numeric(this.yAxisConfig["axis-max"])
        this.yScaleType = this.yAxisConfig['axis-scale'] || 'linear'
        this.yScaleTypeOptions = this.model.get('y-axis-scale-selector') ? ['linear', 'log'] : [this.yScaleType]
        // 0 domain doesn't work with log scale
        if (!_.isFinite(min) || (this.yScaleType == 'log' && min <= 0))
            min = null
        if (!_.isFinite(max) || (this.yScaleType == 'log' && max <= 0))
            max = null
        this.yDomain = [min, max]
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
            this.xScaleType = this.xAxisConfig['axis-scale'] || 'linear'
            this.xScaleTypeOptions = this.model.get('x-axis-scale-selector') ? ['linear', 'log'] : [this.xScaleType]
            // 0 domain doesn't work with log scale
            if (!_.isFinite(min) || (this.xScaleType == 'log' && min <= 0))
                min = null
            if (!_.isFinite(max) || (this.xScaleType == 'log' && max <= 0))
                max = null
            this.xDomain = [min, max]
            this.xAxisLabel = this.xAxisConfig['axis-label'] || ""
            const xAxis = this.xAxisConfig,
                  xAxisPrefix = xAxis["axis-prefix"] || "",
                  xAxisSuffix = xAxis["axis-suffix"] || "",
                  xAxisFormat = xAxis["axis-format"] || 5
            this.xTickFormat = (d) => xAxisPrefix + owid.unitFormat({ format: xAxisFormat||5 }, d) + xAxisSuffix
        })()

        this.availableTabs = (_.sortBy(this.model.get('tabs'), name => {
            if (name == 'chart')
                return 1
            else if (name == 'map')
                return 2
            else
                return 3
        }) as string[])

        this.dimensions = this.model.get('chart-dimensions')        
        this.addCountryMode = this.model.get('add-country-mode')
    }

	constructor(model : any, data: any) {
		this.model = model

        this.syncFromModel()
        this.model.on('change', this.syncFromModel)

        data.ready(() => {
            this.dimensionsWithData = this.model.getDimensions()
        })
        this.model.on('change:chart-dimensions change:chart-type', () => {
            data.ready(() => {
                this.dimensionsWithData = this.model.getDimensions()
            })
        })

        // TODO fix this. Colors shouldn't be part of selectedEntities
		autorun(() => {
			const entities = this.selectedEntities
            const byName = _.keyBy(this.model.get('selected-countries'), 'name')

			if (window.chart && window.chart.vardata) {
				const entityKey = window.chart.vardata.get('entityKey')
                if (!_.isEmpty(entityKey)) {
                    const selectedEntities = _.filter(_.values(entityKey), e => _.includes(entities, e.name))                    
                    _.each(selectedEntities, e => {
                        if (byName[e.name])
                            _.extend(e, byName[e.name])
                    })
                    this.model.set('selected-countries', selectedEntities)
                }
			}
		})

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
            this.model.set('chart-time', toJS(this.timeDomain))
        })

        autorun(() => {            
            this.model.setAxisConfig('y-axis', 'axis-scale', this.yScaleType)
        })

        autorun(() => {
            this.model.setAxisConfig('x-axis', 'axis-scale', this.xScaleType)
        })
	}
}
