import {computed} from 'mobx'
import * as _ from 'lodash'
import ChartConfig from './ChartConfig'
import Color from './Color'
import {DiscreteBarDatum} from './DiscreteBarChart'
import {DimensionWithData} from './ChartData'
import ColorBinder from './ColorBinder'

// Responsible for translating chart configuration into the form
// of a discrete bar chart
export default class DiscreteBarTransform {
    chart: ChartConfig

    constructor(chart: ChartConfig) {
        this.chart = chart
    }

	@computed get baseColorScheme() {
		//return ["#9e0142","#d53e4f","#f46d43","#fdae61","#fee08b","#ffffbf","#e6f598","#abdda4","#66c2a5","#3288bd","#5e4fa2"]
		return ["#F2585B"]
	}

    @computed get colors() {
        const _this = this
        return new ColorBinder({
            get chart() { return _this.chart },
            get colorScheme() { return _this.baseColorScheme }
        })
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