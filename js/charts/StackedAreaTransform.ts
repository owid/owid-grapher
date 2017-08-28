import {computed} from 'mobx'
import * as d3 from 'd3'
import * as _ from 'lodash'
import ChartConfig from './ChartConfig'
import Color from './Color'
import DataKey from './DataKey'
import {StackedAreaSeries, StackedAreaValue} from './StackedArea'
import AxisSpec from './AxisSpec'
import ColorSchemes from './ColorSchemes'
import ColorBinder from './ColorBinder'
import {formatValue} from './Util'

// Responsible for translating chart configuration into the form
// of a stacked area chart
export default class StackedAreaTransform {
    chart: ChartConfig

    constructor(chart: ChartConfig) {
        this.chart = chart
    }

	@computed get baseColorScheme() {
		//return ["#9e0142","#d53e4f","#f46d43","#fdae61","#fee08b","#ffffbf","#e6f598","#abdda4","#66c2a5","#3288bd","#5e4fa2"]
		return _.last(ColorSchemes['owid-distinct'].colors) as Color[]
	}

    @computed get colors() {
        const _this = this
        return new ColorBinder({
            get chart() { return _this.chart },
            get colorScheme() { return _this.baseColorScheme }
        })
    }

	@computed get initialData(): StackedAreaSeries[] {
		const {chart, colors} = this
		const {timeDomain, yAxis, addCountryMode} = chart
        const {filledDimensions, selectedKeys, selectedKeysByKey} = chart.data

		const timeFrom = _.defaultTo(timeDomain[0], -Infinity)
		const timeTo = _.defaultTo(timeDomain[1], Infinity)
		let chartData: StackedAreaSeries[] = []
		const colorKeys: {[key: string]: string} = {}

		_.each(filledDimensions, (dimension, dimIndex) => {
            const {variable} = dimension
			const seriesByKey = new Map<DataKey, StackedAreaSeries>()

			for (var i = 0; i < variable.years.length; i++) {
				const year = variable.years[i]
				const value = +variable.values[i]
				const entity = variable.entities[i]
				const datakey = chart.data.keyFor(entity, dimIndex)
				colorKeys[datakey] = addCountryMode == "change-country" ? _.toString(variable.id) : datakey
				let series = seriesByKey.get(datakey)

				// Not a selected key, don't add any data for it
				if (!selectedKeysByKey[datakey]) continue;
				// Must be numeric
				if (isNaN(value)) continue;
				// Check for time range
				if (year < timeFrom || year > timeTo) continue;

				if (!series) {
					series = {
						values: [],
						key: datakey,
						isProjection: dimension.isProjection,
                        color: "#fff" // tmp
					};
					seriesByKey.set(datakey, series);
				}

				series.values.push({ x: year, y: value, time: year });
			}

			chartData = chartData.concat([...seriesByKey.values()]);
		});

		// Ensure that every series has a value entry for every year in the data
		// Even if that value is just 0
		// Stacked area charts with incomplete data will fail to render otherwise
		var allYears: {[key: number]: boolean} = {};
		var yearsForSeries: {[key: string]: {[key: number]: boolean}} = {};

		chartData.forEach(series => {
			yearsForSeries[series.key] = {}
			series.values.forEach(d => {
				allYears[d.x] = true
				yearsForSeries[series.key][d.x] = true
			})
		})

		chartData.forEach(series => {
			_(allYears).keys().each(yearS => {
				const year = parseInt(yearS)
				if (!yearsForSeries[series.key][year])
					series.values.push({ x: year, y: 0, time: year })//, fake: true })
			})
			series.values = _.sortBy(series.values, function(d) { return d.x; });
		})

		// Preserve order and colorize
		chartData = _.sortBy(chartData, series => -selectedKeys.indexOf(series.key))
		chartData.forEach(series => series.color = colors.getColorForKey(colorKeys[series.key]))

		return chartData
	}

	// It may be that the data being presented is already percentage-like, in which case
	// offering a absolute/relative mode toggle would be redundant
	@computed get isDataRelative(): boolean {
		const {initialData} = this

		if (initialData.length == 0)// || (this.yDimensionFirst && this.yDimensionFirst.variable.shortUnit == "%"))
			return true
			
		let totals = []
		for (var i = 0; i < initialData[0].values.length; i++) {
			totals.push(_(initialData).map(series => series.values[i].y).sum())
		}
		return _.uniq(totals).length == 1
	}

	// Stacked area may display in either absolute or relative mode
	@computed get isRelative(): boolean {
		return this.chart.props.stackMode == 'relative'
	}

	set isRelative(value: boolean) {
		this.chart.props.stackMode = value ? 'relative' : 'absolute'
	}

	@computed get groupedData(): StackedAreaSeries[] {
		let groupedData = _.cloneDeep(this.initialData)

		if (this.isRelative) {
			for (var i = 0; i < groupedData[0].values.length; i++) {
				const total = _(groupedData).map(series => series.values[i].y).sum() as number
				for (var j = 0; j < groupedData.length; j++) {
					groupedData[j].values[i].y = total == 0 ? 0 : (groupedData[j].values[i].y/total)*100
				}
			}
		}

        return groupedData
	}

    @computed get allValues(): StackedAreaValue[] {
        return _(this.groupedData).map(series => series.values).flatten().value() as StackedAreaValue[]
    }

    @computed get xDomainDefault(): [number, number] {
        return [_(this.allValues).map(v => v.x).min() as number, _(this.allValues).map(v => v.x).max() as number]
    }

    @computed get stackedData(): StackedAreaSeries[] {
        const {groupedData, isRelative} = this
        
        if (_.some(groupedData, series => series.values.length !== groupedData[0].values.length))
            throw `Unexpected variation in stacked area chart series: ${_.map(groupedData, series => series.values.length)}`

        let stackedData = _.cloneDeep(groupedData)

        for (var i = 1; i < stackedData.length; i++) {
            for (var j = 0; j < stackedData[0].values.length; j++) {
                stackedData[i].values[j].y += stackedData[i-1].values[j].y
            }
        }

        return stackedData
    }

    @computed get yDomainDefault(): [number, number] {
        return [0, (_(this.stackedData).map('values').flatten().map('y').max() as number)]
    }

    @computed get xAxis(): AxisSpec {
        const {chart, xDomainDefault} = this
        return _.extend(
            chart.xAxis.toSpec({ defaultDomain: xDomainDefault }),
            { tickFormat: (year: number) => year.toString() }
        ) as AxisSpec
    }

    @computed get yDimensionFirst() {
        return _.find(this.chart.data.filledDimensions, { property: 'y' })
    }
		
    @computed get yAxis(): AxisSpec {
        const {chart, yDomainDefault, isRelative, yDimensionFirst} = this
		const tickFormat = yDimensionFirst ? yDimensionFirst.formatValueShort : _.identity

        return _.extend(
            chart.yAxis.toSpec({ defaultDomain: yDomainDefault }),
            { domain: isRelative ? [0, 100] : [yDomainDefault[0], yDomainDefault[1]], // Stacked area chart must have its own y domain
			  tickFormat: isRelative ? (v: number) => formatValue(v, { unit: "%" }) : tickFormat }
        ) as AxisSpec
    }

}