import {computed} from 'mobx'
import * as _ from 'lodash'
import ChartConfig from './ChartConfig'
import Color from './Color'
import {DiscreteBarDatum} from './DiscreteBarChart'
import {DimensionWithData} from './ChartData'
import ColorBinder from './ColorBinder'
import IChartTransform from './IChartTransform'

// Responsible for translating chart configuration into the form
// of a discrete bar chart
export default class DiscreteBarTransform implements IChartTransform {
    chart: ChartConfig

    constructor(chart: ChartConfig) {
        this.chart = chart
    }

    @computed get isValidConfig() {
        return _.some(this.chart.dimensions, d => d.property == 'y')
    }

    @computed get failMessage(): string|undefined {
        const {filledDimensions} = this.chart.data
        if (!_.some(filledDimensions, d => d.property == 'y'))
            return "Missing variable"
        else if (_.isEmpty(this.data))
            return "No matching data"
    }

	@computed get baseColorScheme() {
		return ["#F2585B"]
	}

    @computed get colors() {
        const _this = this
        return new ColorBinder({
            get chart() { return _this.chart },
            get colorScheme() { return _this.baseColorScheme }
        })
    }

    @computed get primaryDimension(): DimensionWithData|undefined {
        return _.find(this.chart.data.filledDimensions, d => d.property == "y")
    }

    @computed get targetYear(): number {
        const maxYear = this.chart.timeDomain[1]
        if (!this.primaryDimension) return 1900

        const {variable} = this.primaryDimension
        if (maxYear != null)
            return _.sortBy(variable.yearsUniq, year => Math.abs(year-maxYear))[0];
        else
            return _.max(variable.yearsUniq) as number;

    }

    @computed get data(): DiscreteBarDatum[] {
		const {chart, targetYear, colors} = this
        const {filledDimensions, selectedKeysByKey} = chart.data
        const data: DiscreteBarDatum[] = []

		_.each(filledDimensions, (dimension, dimIndex) => {
            const {variable} = dimension

			for (var i = 0; i < variable.years.length; i++) {
				const year = variable.years[i]
				const value = parseFloat(variable.values[i] as string)
				const entity = variable.entities[i]
				const datakey = chart.data.keyFor(entity, dimIndex)

				// Not a selected key, don't add any data for it
				if (year != targetYear || !selectedKeysByKey[datakey]) continue;

                data.push({
                    value: +variable.values[i],
                    label: chart.data.formatKey(datakey),
                    color: colors.getColorForKey(datakey)
                })
			}
		});

        return _.sortBy(data, d => -d.value)
    }
}