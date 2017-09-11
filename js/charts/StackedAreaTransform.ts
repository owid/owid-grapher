import {computed} from 'mobx'
import * as d3 from 'd3'
import {some, isEmpty, last, union, min, max, sortBy, uniq, cloneDeep, keys, sum, extend, find, identity} from './Util'
import ChartConfig from './ChartConfig'
import Color from './Color'
import DataKey from './DataKey'
import {StackedAreaSeries, StackedAreaValue} from './StackedArea'
import AxisSpec from './AxisSpec'
import ColorSchemes from './ColorSchemes'
import ColorBinder from './ColorBinder'
import {formatValue, formatYear, defaultTo, findClosest} from './Util'
import IChartTransform from './IChartTransform'

// Responsible for translating chart configuration into the form
// of a stacked area chart
export default class StackedAreaTransform implements IChartTransform {
    chart: ChartConfig

    constructor(chart: ChartConfig) {
        this.chart = chart
    }

	@computed get isValidConfig(): boolean {
		return some(this.chart.dimensions, d => d.property == 'y')
	}

    @computed get failMessage(): string|undefined {
        const {filledDimensions} = this.chart.data
        if (!some(filledDimensions, d => d.property == 'y'))
            return "Missing Y axis variable"
        else if (isEmpty(this.groupedData))
            return "No matching data"
    }

	@computed get baseColorScheme() {
		//return ["#9e0142","#d53e4f","#f46d43","#fdae61","#fee08b","#ffffbf","#e6f598","#abdda4","#66c2a5","#3288bd","#5e4fa2"]
		return last(ColorSchemes['owid-distinct'].colors) as Color[]
	}

    @computed get timelineYears(): number[] {
        return union(...this.chart.data.axisDimensions.map(d => d.variable.yearsUniq))
    }

    @computed get minTimelineYear(): number {
        return defaultTo(min(this.timelineYears), 1900)
    }

    @computed get maxTimelineYear(): number {
        return defaultTo(max(this.timelineYears), 2000)
    }

    @computed get startYear(): number {
        const minYear = defaultTo(this.chart.timeDomain[0], this.minTimelineYear)
        return defaultTo(findClosest(this.timelineYears, minYear), this.minTimelineYear)
    }

    @computed get endYear(): number {
        const maxYear = defaultTo(this.chart.timeDomain[1], this.maxTimelineYear)
        return defaultTo(findClosest(this.timelineYears, maxYear), this.maxTimelineYear)
    }

	@computed get initialData(): StackedAreaSeries[] {
		const {chart, startYear, endYear} = this
		const {timeDomain, yAxis, addCountryMode} = chart
        const {filledDimensions, selectedKeys, selectedKeysByKey} = chart.data

		let chartData: StackedAreaSeries[] = []
		const colorKeys: {[key: string]: string} = {}

		filledDimensions.forEach((dimension, dimIndex) => {
            const {variable} = dimension
			const seriesByKey = new Map<DataKey, StackedAreaSeries>()

			for (var i = 0; i < variable.years.length; i++) {
				const year = variable.years[i]
				const value = +variable.values[i]
				const entity = variable.entities[i]
				const datakey = chart.data.keyFor(entity, dimIndex)
				let series = seriesByKey.get(datakey)

				// Not a selected key, don't add any data for it
				if (!selectedKeysByKey[datakey]) continue;
				// Must be numeric
				if (isNaN(value)) continue;
				// Check for time range
				if (year < startYear || year > endYear) continue;
				// Stacked area chart can't go negative!
				if (value < 0) continue;


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

			chartData = chartData.concat([...Array.from(seriesByKey.values())]);
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

			keys(allYears).forEach(yearStr => {
				const year = parseInt(yearStr)
				if (!yearsForSeries[series.key][year])
					series.values.push({ x: year, y: 0, time: year })//, fake: true })
			})
			series.values = sortBy(series.values, function(d) { return d.x; });
		})

		// Preserve order
		chartData = sortBy(chartData, series => -selectedKeys.indexOf(series.key))

        // Assign colors
        const colorScale = d3.scaleOrdinal(this.baseColorScheme)
        chartData.forEach(series => {
            series.color = chart.data.keyColors[series.key] || colorScale(series.key)
        })

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
			totals.push(sum(initialData.map(series => series.values[i].y)))
		}
		return uniq(totals).length == 1
	}

	@computed get canToggleRelative(): boolean {
		return !this.chart.props.hideRelativeToggle
	}

	// Stacked area may display in either absolute or relative mode
	@computed get isRelative(): boolean {
		return this.chart.props.stackMode == 'relative'
	}

	set isRelative(value: boolean) {
		this.chart.props.stackMode = value ? 'relative' : 'absolute'
	}

	@computed get groupedData(): StackedAreaSeries[] {
		let groupedData = cloneDeep(this.initialData)

		if (this.isRelative) {
			if (groupedData.length == 0)
				return []
			
			for (var i = 0; i < groupedData[0].values.length; i++) {
				const total = sum(groupedData.map(series => series.values[i].y))
				for (var j = 0; j < groupedData.length; j++) {
					groupedData[j].values[i].y = total == 0 ? 0 : (groupedData[j].values[i].y/total)*100
				}
			}
		}

        return groupedData
	}

    @computed get xDomainDefault(): [number, number] {
		return [this.startYear, this.endYear]
    }

    @computed get stackedData(): StackedAreaSeries[] {
        const {groupedData, isRelative} = this
        
        if (some(groupedData, series => series.values.length !== groupedData[0].values.length))
            throw `Unexpected variation in stacked area chart series: ${groupedData.map(series => series.values.length)}`

        let stackedData = cloneDeep(groupedData)

        for (var i = 1; i < stackedData.length; i++) {
            for (var j = 0; j < stackedData[0].values.length; j++) {
                stackedData[i].values[j].y += stackedData[i-1].values[j].y
            }
        }

        return stackedData
    }

    @computed get allStackedValues(): StackedAreaValue[] {
		const allValues: StackedAreaValue[] = []
		this.stackedData.forEach(series => allValues.push(...series.values))
		return allValues
    }

    @computed get yDomainDefault(): [number, number] {
		const yValues = this.allStackedValues.map(d => d.y)
		return [
			0,
			defaultTo(max(yValues), 100)
		]
    }

    @computed get xAxis(): AxisSpec {
        const {chart, xDomainDefault} = this
        return extend(
            chart.xAxis.toSpec({ defaultDomain: xDomainDefault }),
            { tickFormat: (year: number) => formatYear(year) }
        ) as AxisSpec
    }

    @computed get yDimensionFirst() {
        return find(this.chart.data.filledDimensions, d => d.property == 'y')
    }
		
    @computed get yAxis(): AxisSpec {
        const {chart, yDomainDefault, isRelative, yDimensionFirst} = this
		const tickFormat = yDimensionFirst ? yDimensionFirst.formatValueShort : identity

        return extend(
            chart.yAxis.toSpec({ defaultDomain: yDomainDefault }),
            { domain: isRelative ? [0, 100] : [yDomainDefault[0], yDomainDefault[1]], // Stacked area chart must have its own y domain
			  tickFormat: isRelative ? (v: number) => formatValue(v, { unit: "%" }) : tickFormat,
			  label: isRelative ? undefined : chart.yAxis.label }
        ) as AxisSpec
    }

}