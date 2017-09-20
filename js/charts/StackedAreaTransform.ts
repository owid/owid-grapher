import {computed} from 'mobx'
import {scaleOrdinal} from 'd3-scale'
import {some, isEmpty, min, max, sortBy, cloneDeep, sum, extend, find, identity, sortedUniq} from './Util'
import ChartConfig from './ChartConfig'
import DataKey from './DataKey'
import {StackedAreaSeries, StackedAreaValue} from './StackedArea'
import AxisSpec from './AxisSpec'
import ColorSchemes from './ColorSchemes'
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
		else
			return undefined
    }

	// Get the data for all years, before any time filtering
	@computed get initialData(): StackedAreaSeries[] {
		const {chart} = this
        const {filledDimensions, selectedKeysByKey} = chart.data

		let chartData: StackedAreaSeries[] = []

		filledDimensions.forEach((dimension, dimIndex) => {
			const seriesByKey = new Map<DataKey, StackedAreaSeries>()

			for (var i = 0; i < dimension.years.length; i++) {
				const year = dimension.years[i]
				const value = +dimension.values[i]
				const entity = dimension.entities[i]
				const datakey = chart.data.keyFor(entity, dimIndex)
				let series = seriesByKey.get(datakey)

				// Not a selected key, don't add any data for it
				if (!selectedKeysByKey[datakey]) continue;
				// Must be numeric
				if (isNaN(value)) continue;
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

		return chartData
	}

    @computed get timelineYears(): number[] {	
		const allYears: number[] = []
		this.initialData.forEach(g => allYears.push(...g.values.map(d => d.x)))
		return sortedUniq(sortBy(allYears))
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

	@computed get colorScheme() {
		//return ["#9e0142","#d53e4f","#f46d43","#fdae61","#fee08b","#ffffbf","#e6f598","#abdda4","#66c2a5","#3288bd","#5e4fa2"]
		const schemeName = defaultTo(this.chart.props.baseColorScheme, "stackedArea")
		return ColorSchemes[schemeName]
	}

	@computed get baseColors() {
		return this.colorScheme.getDistinctColors(this.initialData.length)
	}

	@computed get groupedData(): StackedAreaSeries[] {
		const {chart, startYear, endYear} = this
		const {selectedKeys} = chart.data

		let groupedData = cloneDeep(this.initialData)

		groupedData.forEach(series => {
			series.values = series.values.filter(d => d.x >= startYear && d.x <= endYear)
		})
		
		// Ensure that every series has a value entry for every year in the data
		let allYears: number[] = []
		groupedData.forEach(series => allYears.push(...series.values.map(d => d.x)))
		allYears = sortedUniq(sortBy(allYears))

		groupedData.forEach(series => {
			let i = 0
			let isBeforeStart = true

			while (i < allYears.length) {
				const value = series.values[i]
				const expectedYear = allYears[i]

				if (value === undefined || value.x > allYears[i]) {
					let fakeY = 0

					if (!isBeforeStart && i < series.values.length) {
						// Missing data in the middle-- interpolate a value
						const prevValue = series.values[i-1]
						const nextValue = series.values[i]
						fakeY = (nextValue.y+prevValue.y)/2
					}

					series.values.splice(i, 0, { x: expectedYear, y: fakeY, time: expectedYear, isFake: true })
				} else {
					isBeforeStart = false
				}
				i += 1
			}
		})

		// Preserve order
		groupedData = sortBy(groupedData, series => -selectedKeys.indexOf(series.key))

        // Assign colors
        const colorScale = scaleOrdinal(this.baseColors)
        groupedData.forEach(series => {
            series.color = chart.data.keyColors[series.key] || colorScale(series.key)
        })
		
		// In relative mode, transform data to be a percentage of the total for that year
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
        const {groupedData} = this
        
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