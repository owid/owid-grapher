import {computed} from 'mobx'
import * as _ from 'lodash'
import ChartConfig from './ChartConfig'
import Color from './Color'
import {DiscreteBarDatum} from './DiscreteBarChart'

// Responsible for translating chart configuration into the form
// of a discrete bar chart
export default class DiscreteBarTransform {
    chart: ChartConfig

    constructor(chart: ChartConfig) {
        this.chart = chart
    }

	@computed get data(): DiscreteBarDatum[] {
        const {chart} = this
        const {timeDomain} = chart
        const {filledDimensions, selectedKeysByKey} = chart.data

		const timeFrom = _.defaultTo(timeDomain[0], -Infinity)
		const timeTo = _.defaultTo(timeDomain[1], Infinity)
        const dimension = _.find(filledDimensions, d => d.property == "y")
        if (!dimension) return []
        const {variable} = dimension

        let targetYear
        if (_.isFinite(timeTo))
            targetYear = _.sortBy(variable.yearsUniq, year => Math.abs(year-timeTo))[0];
        else
            targetYear = _.max(variable.yearsUniq);

        const data: DiscreteBarDatum[] = []

        for (var i = 0; i < variable.years.length; i++) {
            const year = variable.years[i]
            const entity = variable.entities[i]
            const key = chart.data.keyFor(entity, 0)

//            if (year != targetYear || !selectedKeysByKey[key]) continue;
            if (year != targetYear) continue;

            data.push({
                value: +variable.values[i],
                label: chart.data.formatKey(key),
                color: chart.colors.assignColorForKey(key)
            })
        }

        return _.sortBy(data, d => -d.value)
	}
}