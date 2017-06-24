declare function require(name:string): any;
const owid: any = require('../owid').default
import * as _ from 'lodash'
import {observable, computed, action, autorun, toJS} from 'mobx'
import {ScaleType} from './AxisScale'
import {ComparisonLineConfig} from './ComparisonLine'
import {component} from './Util'
import AxisConfig, {AxisConfigProps} from './AxisConfig'
import {ChartTypeType} from './ChartType'
import EntityKey from './EntityKey'
import ChartTabOption from './ChartTabOption'
import LineType from './LineType'
import {defaultTo} from './Util'

export interface TimelineConfig {
    compareEndPointsOnly?: boolean
}

// WIP
export class ChartConfigProps {
    @observable.ref type: ChartTypeType = "LineChart"
    @observable.ref slug?: string = undefined
    @observable.ref title?: string = undefined
    @observable.ref subtitle?: string = undefined
    @observable.ref sourceDesc?: string = undefined
    @observable.ref note?: string = undefined

    @observable.ref xAxis: AxisConfigProps = new AxisConfigProps()
    @observable.ref yAxis: AxisConfigProps = new AxisConfigProps()

    @observable.struct selectedEntities: EntityKey[] = []
    @observable.struct timeDomain: [number|null, number|null]
    @observable.struct entityColors: {[key: string]: string} = {}

    @observable.struct dimensions: Object[] = []
    @observable.ref addCountryMode: 'add-country'|'change-country'|'disabled' = 'add-country'

    // XXX special line chart stuff that should maybe go elsewhere
    @observable.ref timeline?: TimelineConfig = undefined
    @observable.ref comparisonLine?: ComparisonLineConfig = undefined
    @observable.ref lineType: LineType = LineType.WithDots
    @observable.ref lineTolerance?: number = undefined

    @observable.ref hasChartTab: boolean = true
    @observable.ref hasMapTab: boolean = false
    @observable.ref tab: ChartTabOption = 'chart'

    @observable.ref internalNotes?: string = undefined
    @observable.ref logosSVG: string[] = []
    @observable.ref originUrl?: string = undefined
    @observable.ref isPublished?: true = undefined
}

// In-progress mobx model layer that will eventually replace ChartModel
export default class ChartConfig {
    props: ChartConfigProps = new ChartConfigProps()

    @computed get type() { return this.props.type }
    @computed get slug() { return defaultTo(this.props.slug, "") }
    @computed get title() { return defaultTo(this.props.title, "") }
    @computed get subtitle() { return defaultTo(this.props.subtitle, "") }
    @computed get sourceDesc() { return defaultTo(this.props.sourceDesc, "") }
    @computed get note() { return defaultTo(this.props.note, "") }
    @computed get internalNotes() { return defaultTo(this.props.internalNotes, "") }
    @computed get logosSVG() { return this.props.logosSVG }
    @computed get originUrl() { return defaultTo(this.props.originUrl, "") }
    @computed get isPublished() { return defaultTo(this.props.isPublished, false) }
    @computed get selectedEntities() { return this.props.selectedEntities }
    @computed get timeDomain() { return this.props.timeDomain }
    @computed get entityColors() { return this.props.entityColors }
    @computed get tab() { return this.props.tab }
    @computed get lineType() { return defaultTo(this.props.lineType, LineType.WithDots) }
    @computed get lineTolerance() { return defaultTo(this.props.lineTolerance, 1) }
    @computed get dimensions() { return this.props.dimensions }
    @computed get addCountryMode() { return this.props.addCountryMode }
    @computed get comparisonLine() { return this.props.comparisonLine }
    @computed get timeline() { return this.props.timeline }

    set timeDomain(value) { this.props.timeDomain = value }
    set tab(value) { this.props.tab = value }
    set selectedEntities(value) { this.props.selectedEntities = value }

    xAxis: AxisConfig
    yAxis: AxisConfig

    @observable.ref dimensionsWithData: Object[]

	model: any

    @computed get selectedEntitiesByName() {
        return _.keyBy(this.selectedEntities)
    }

    @computed get availableTabs(): ChartTabOption[] {
        return _.filter([this.props.hasChartTab && 'chart', this.props.hasMapTab && 'map', 'data', 'sources']) as ChartTabOption[]
    }

    @action.bound update(props: any) {
        this.props.type = props['chart-type']
        this.props.slug = props['slug']
        this.props.title = props['title']
        this.props.subtitle = props['subtitle']
        this.props.sourceDesc = props['sourceDesc']
        this.props.note = props['chart-description']
        this.props.internalNotes = props['internalNotes']
        this.props.logosSVG = props['logosSVG']
        this.props.originUrl = props['data-entry-url']
        this.props.isPublished = props['published']

        this.props.selectedEntities = props['selected-countries'].map((e: any) => e.name)
        this.props.entityColors = {}
        props['selected-countries'].forEach((e: any) => {
            if (e.color)
                this.props.entityColors[e.name] = e.color
        })
        this.props.timeline = props['timeline']

        const timeDomain = props['chart-time']
        if (!timeDomain)
            this.props.timeDomain = [null, null]
        else
            this.props.timeDomain = (_.map(timeDomain, v => _.isString(v) ? parseInt(v) : v) as [number|null, number|null])

        this.props.hasChartTab = props['tabs'].includes("chart")
        this.props.hasMapTab = props['tabs'].includes("map")

        this.props.xAxis = props['xAxis']
        this.props.yAxis = props['yAxis']

        this.props.dimensions = props['chart-dimensions'] 
        this.props.addCountryMode = props['add-country-mode']
        this.props.comparisonLine = props["comparisonLine"]
        this.props.tab = props["default-tab"]

        this.props.lineType = props["line-type"]
        this.props.lineTolerance = parseInt(props["line-tolerance"]) || 1
    }

	constructor(model : any, data: any) {
        this.xAxis = new AxisConfig()
        this.yAxis = new AxisConfig()

		this.model = model

        this.update(this.model.toJSON())
        this.model.on('change', () => this.update(this.model.toJSON()))

        data.ready(action(() => {
            this.dimensionsWithData = this.model.getDimensions()
        }))
        this.model.on('change:chart-dimensions change:chart-type', () => {
            data.ready(action(() => {
                this.dimensionsWithData = this.model.getDimensions()
            }))
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
            this.model.set('comparisonLine', toJS(this.comparisonLine))
        })

        autorun(() => {
            this.model.set('tabs', this.availableTabs)
        })

        autorun(() => {            
            this.model.set('xAxis', toJS(this.xAxis.props))
        })

        autorun(() => {
            this.model.set('yAxis', toJS(this.yAxis.props))
        })

        autorun(() => { this.model.set('default-tab', this.tab) })
	}
}
