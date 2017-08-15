import {computed} from 'mobx'
import * as _ from 'lodash'
import ChartConfig from './ChartConfig'
import Color from './Color'
import DataKey from './DataKey'
import {StackedAreaSeries, StackedAreaValue} from './StackedArea'
import AxisSpec from './AxisSpec'

// Responsible for translating chart configuration into the form
// of a stacked area chart
export default class StackedAreaTransform {
    chart: ChartConfig

    constructor(chart: ChartConfig) {
        this.chart = chart
    }

	// Stacked area may display in either absolute or relative mode
	@computed get isRelative(): boolean {
		return this.chart.props.stackMode == 'relative'
	}

	set isRelative(value: boolean) {
		this.chart.props.stackMode = value ? 'relative' : 'absolute'
	}

	@computed get groupedData(): StackedAreaSeries[] {
		const {chart} = this
		const {timeDomain, yAxis, addCountryMode} = chart
        const {filledDimensions, selectedKeysByKey} = chart.data

		const timeFrom = _.defaultTo(timeDomain[0], -Infinity)
		const timeTo = _.defaultTo(timeDomain[1], Infinity)
		let chartData: StackedAreaSeries[] = []

		_.each(filledDimensions, (dimension, dimIndex) => {
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
				// Check for time range
				if (year < timeFrom || year > timeTo) continue;

				if (!series) {
					series = {
						values: [],
						key: datakey,
						isProjection: dimension.isProjection,
                        color: chart.colors.assignColorForKey(datakey)
					};
					seriesByKey.set(datakey, series);
				}

				series.values.push({ x: year, y: value, time: year });
			}

			chartData = chartData.concat([...seriesByKey.values()]);
		});

        return chartData
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

		if (isRelative) {
			for (var i = 0; i < stackedData[0].values.length; i++) {
				const maxValue = _(stackedData).map(series => series.values[i].y).max() as number
				for (var j = 0; j < stackedData.length; j++) {
					stackedData[j].values[i].y = (stackedData[j].values[i].y/maxValue)*100
				}
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

    @computed get yAxis(): AxisSpec {
        const {chart, yDomainDefault, isRelative} = this
        
        return _.extend(
            chart.yAxis.toSpec({ defaultDomain: yDomainDefault }),
            { domain: isRelative ? [0, 100] : [yDomainDefault[0], chart.yAxis.domain[1]||yDomainDefault[1]],
			  tickFormat: isRelative ? (v: number) => v.toString()+"%" : chart.yAxis.tickFormat }
        ) as AxisSpec
    }

	// Ensures that every series has a value entry for every year in the data
	// Even if that value is just 0
	// Stacked area charts with incomplete data will fail to render otherwise
	/*zeroPadData(chartData) {
		var allYears = {};
		var yearsForSeries = {};

		_.each(chartData, function(series) {
			yearsForSeries[series.id] = {};
			_.each(series.values, function(d, i) {
				allYears[d.x] = true;
				yearsForSeries[series.id][d.x] = true;
			});
		});

		_.each(chartData, function(series) {
			_.each(Object.keys(allYears), function(year) {
				year = parseInt(year);
				if (!yearsForSeries[series.id][year])
					series.values.push({ x: year, y: 0, time: year, fake: true });
			});

			series.values = _.sortBy(series.values, function(d) { return d.x; });
		});

		return chartData;
	}*/
}