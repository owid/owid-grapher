import {computed} from 'mobx'
import {some, min, max, isEmpty, sortBy, find, identity, cloneDeep, sortedUniq} from './Util'
import ChartConfig from './ChartConfig'
import DataKey from './DataKey'
import {LineChartSeries, LineChartValue} from './LineChart'
import AxisSpec from './AxisSpec'
import {defaultTo, formatYear, findClosest} from './Util'
import ColorSchemes from './ColorSchemes'
import IChartTransform from './IChartTransform'
import DimensionWithData from './DimensionWithData'

// Responsible for translating chart configuration into the form
// of a line chart
export default class LineChartTransform implements IChartTransform {
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

	@computed get initialData(): LineChartSeries[] {
		const {chart} = this
		const {yAxis} = chart
        const {filledDimensions, selectedKeys, selectedKeysByKey} = chart.data

		let chartData: LineChartSeries[] = []

		filledDimensions.forEach((dimension, dimIndex) => {
			const seriesByKey = new Map<DataKey, LineChartSeries>()

			for (var i = 0; i < dimension.years.length; i++) {
				const year = dimension.years[i]
				const value = parseFloat(dimension.values[i] as string)
				const entity = dimension.entities[i]
				const datakey = chart.data.keyFor(entity, dimIndex)
				let series = seriesByKey.get(datakey)

				// Not a selected key, don't add any data for it
				if (!selectedKeysByKey[datakey]) continue;
                // Can't have values <= 0 on log scale
                if (value <= 0 && yAxis.scaleType == 'log') continue;

				if (!series) {
					series = {
						values: [],
						key: datakey,
						isProjection: dimension.isProjection,
                        formatValue: dimension.formatValueLong,
                        color: "#000" // tmp
					};
					seriesByKey.set(datakey, series);
				}

				series.values.push({ x: year, y: value, time: year, gapYearsToNext: 0 });
			}

			chartData = chartData.concat([...Array.from(seriesByKey.values())]);
		});

        // Color from lowest to highest
        chartData = sortBy(chartData, series => series.values[series.values.length-1].y)        
		const schemeName = defaultTo(this.chart.props.baseColorScheme, "owid-distinct")
		const colorScheme = ColorSchemes[schemeName]
        const colors = colorScheme.getDistinctColors(chartData.length)
        chartData.forEach((series, i) => {
            series.color = chart.data.keyColors[series.key] || colors[i]
        })

        // Preserve the original ordering for render. Note for line charts, the series order only affects the visual stacking order on overlaps.
        chartData = sortBy(chartData, series => selectedKeys.indexOf(series.key))


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

    @computed get allValues(): LineChartValue[] {
        const allValues: LineChartValue[] = []
        this.initialData.forEach(series => allValues.push(...series.values))
        return allValues
    }

    @computed get xDomain(): [number, number] {
        return [this.startYear, this.endYear]
    }

    @computed get xAxis(): AxisSpec {
        const {xDomain} = this
        return {
            label: "",
            tickFormat: formatYear,
            domain: xDomain,
            scaleType: 'linear',
            scaleTypeOptions: ['linear']
        }
    }

    @computed get yDimensionFirst(): DimensionWithData|undefined {
        return find(this.chart.data.filledDimensions, d => d.property == 'y')
    }

    @computed get yDomainDefault(): [number, number] {
        const yValues = this.allValues.map(v => v.y)
        return [
            defaultTo(min(yValues), 0),
            defaultTo(max(yValues), 100)
        ]
    }

    @computed get yDomain(): [number, number] {
        const {chart, yDomainDefault} = this
        return [
            Math.min(defaultTo(chart.yAxis.domain[0], Infinity), yDomainDefault[0]),
            Math.max(defaultTo(chart.yAxis.domain[1], -Infinity), yDomainDefault[1])
        ]
    }

    @computed get yAxis(): AxisSpec {
        const {chart, yDomain, yDimensionFirst} = this
        return {
            label: chart.yAxis.label||"",
            tickFormat: yDimensionFirst ? yDimensionFirst.formatValueShort : identity,
            domain: yDomain,
            scaleType: chart.yAxis.scaleType,
            scaleTypeOptions: chart.yAxis.scaleTypeOptions            
        }
    }

    // Filter the data so it fits within the domains
    @computed get groupedData(): LineChartSeries[] {
        const {initialData, xAxis, yAxis} = this
        const groupedData = cloneDeep(initialData)

        groupedData.forEach(g => {
            g.values = g.values.filter(d => d.x >= xAxis.domain[0] && d.x <= xAxis.domain[1] && d.y >= yAxis.domain[0] && d.y <= yAxis.domain[1])
        })

        return groupedData.filter(g => g.values.length > 0)
    }
}