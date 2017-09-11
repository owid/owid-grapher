import {computed} from 'mobx'
import {some, union, min, max, isEmpty, sortBy, extend, find, identity, cloneDeep} from './Util'
import {scaleOrdinal} from 'd3-scale'
import ChartConfig from './ChartConfig'
import Color from './Color'
import DataKey from './DataKey'
import {LineChartSeries, LineChartValue} from './LineChart'
import AxisSpec from './AxisSpec'
import {defaultTo, formatYear, findClosest, last} from './Util'
import {DimensionWithData} from './ChartData'
import ColorBinder from './ColorBinder'
import ColorSchemes from './ColorSchemes'
import IChartTransform from './IChartTransform'

// Responsible for translating chart configuration into the form
// of a line chart
export default class LineChartTransform implements IChartTransform {
    chart: ChartConfig
    constructor(chart: ChartConfig) {
        this.chart = chart
    }

    @computed get isValidConfig() {
        return some(this.chart.dimensions, d => d.property == 'y')
    }

    @computed get failMessage(): string|undefined {
        const {filledDimensions} = this.chart.data
        if (!some(filledDimensions, d => d.property == 'y'))
            return "Missing Y axis variable"
        else if (isEmpty(this.groupedData))
            return "No matching data"
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

	@computed get initialData(): LineChartSeries[] {
		const {chart, startYear, endYear} = this
		const {timeDomain, yAxis, addCountryMode} = chart
        const {filledDimensions, selectedKeys, selectedKeysByKey} = chart.data

		let chartData: LineChartSeries[] = []

		filledDimensions.forEach((dimension, dimIndex) => {
            const {variable} = dimension
			const seriesByKey = new Map<DataKey, LineChartSeries>()

			for (var i = 0; i < variable.years.length; i++) {
				const year = variable.years[i]
				const value = parseFloat(variable.values[i] as string)
				const entity = variable.entities[i]
				const datakey = chart.data.keyFor(entity, dimIndex)
				let series = seriesByKey.get(datakey)

				// Not a selected key, don't add any data for it
				if (!selectedKeysByKey[datakey]) continue;
				// Check for time range
				if (year < startYear || year > endYear) continue;
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

        // Preserve ordering. Note for line charts, the series order only affects the visual stacking order on overlaps.
        chartData = sortBy(chartData, series => selectedKeys.indexOf(series.key))

        // Assign colors
        const colorScheme = last(ColorSchemes['owid-distinct'].colors) as Color[]
        const colorScale = scaleOrdinal(colorScheme)
        chartData.forEach(series => {
            series.color = chart.data.keyColors[series.key] || colorScale(series.key)
        })

        return chartData
	}

    @computed get allValues(): LineChartValue[] {
        const allValues: LineChartValue[] = []
        this.initialData.forEach(series => allValues.push(...series.values))
        return allValues
    }

    @computed get xDomainDefault(): [number, number] {
        return [this.startYear, this.endYear]
    }

    @computed get yDomainDefault(): [number, number] {
        const yValues = this.allValues.map(v => v.y)
        return [
            defaultTo(min(yValues), 0),
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
        const {chart, yDomainDefault, yDimensionFirst} = this

        return {
            label: chart.yAxis.label||"",
            tickFormat: yDimensionFirst ? yDimensionFirst.formatValueShort : identity,
            domain: [Math.min(defaultTo(chart.yAxis.domain[0], Infinity), yDomainDefault[0]), Math.max(defaultTo(chart.yAxis.domain[1], -Infinity), yDomainDefault[1])],
            scaleType: chart.yAxis.scaleType,
            scaleTypeOptions: chart.yAxis.scaleTypeOptions            
        }
    }

    // Filter the data so it fits within the domains
    @computed get groupedData() {
        const {initialData, xAxis, yAxis} = this
        const groupedData = cloneDeep(initialData)

        groupedData.forEach(g => {
            g.values = g.values.filter(d => d.x >= xAxis.domain[0] && d.x <= xAxis.domain[1] && d.y >= yAxis.domain[0] && d.y <= yAxis.domain[1])
        })

        return groupedData.filter(g => g.values.length > 0)
    }
}