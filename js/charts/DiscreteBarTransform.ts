import {computed} from 'mobx'
import * as _ from 'lodash'
import ChartConfig from './ChartConfig'
import Color from './Color'
import {DiscreteBarDatum} from './DiscreteBarChart'
import {DimensionWithData} from './ChartData'

// Responsible for translating chart configuration into the form
// of a discrete bar chart
export default class DiscreteBarTransform {
    chart: ChartConfig

    constructor(chart: ChartConfig) {
        this.chart = chart
    }

    @computed get primaryDimension(): DimensionWithData {
        return _.find(this.chart.data.filledDimensions, d => d.property == "y") as DimensionWithData
    }

    @computed get targetYear(): number {
        const maxYear = this.chart.timeDomain[1]
        const {variable} = this.primaryDimension
        if (maxYear != null)
            return _.sortBy(variable.yearsUniq, year => Math.abs(year-maxYear))[0];
        else
            return _.max(variable.yearsUniq) as number;

    }

	/*@computed get data(): DiscreteBarDatum[] {
        const {chart, targetYear, primaryDimension} = this
        const {filledDimensions, selectedKeysByKey} = chart.data
        if (!primaryDimension) return []
        const {variable} = primaryDimension

        const data: DiscreteBarDatum[] = []

        for (var i = 0; i < variable.years.length; i++) {
            const year = variable.years[i]
            const entity = variable.entities[i]
            const key = chart.data.keyFor(entity, 0)

            if (year != targetYear || !selectedKeysByKey[key]) continue;
//            if (year != targetYear) continue;

            data.push({
                value: +variable.values[i],
                label: chart.data.formatKey(key),
                color: chart.colors.assignColorForKey(key)
            })
        }

        return _.sortBy(data, d => -d.value)
	}*/

    @computed get data(): DiscreteBarDatum[] {
		const {chart, targetYear} = this
		const {timeDomain, yAxis, addCountryMode} = chart
        const {filledDimensions, selectedKeysByKey} = chart.data

		const timeFrom = _.defaultTo(timeDomain[0], -Infinity)
		const timeTo = _.defaultTo(timeDomain[1], Infinity)
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
                    color: chart.colors.assignColorForKey(datakey)
                })
			}
		});

        return _.sortBy(data, d => -d.value)
    }
}