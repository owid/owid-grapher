import {computed} from 'mobx'
import * as _ from 'lodash'
import ChartConfig from './ChartConfig'

// Responsible for translating chart configuration into the form
// of a discrete bar chart
class DiscreteBarTransform {
    chart: ChartConfig

    constructor(chart: ChartConfig) {
        this.chart = chart
    }

	@computed get data() {
        const {chart} = this
        const {dimensions, vardata, timeDomain, selectedEntitiesByKey} = chart
        const {variablesById} = vardata

		const timeFrom = _.defaultTo(timeDomain[0], -Infinity)
		const timeTo = _.defaultTo(timeDomain[1], Infinity)
        const dimension = _.find(dimensions, d => d.property == "y")


        const variable = variablesById[dimension.variableId]
        const valuesByEntity = {}

        let targetYear
        if (_.isFinite(timeTo))
            targetYear = _.sortBy(variable.yearsUniq, function(year) { return Math.abs(year-timeTo); })[0];
        else
            targetYear = _.max(variable.yearsUniq);

        var series = {
            values: [],
            key: variable.name,
            id: dimension.variableId
        };

        for (var i = 0; i < variable.years.length; i++) {
            var year = parseInt(variable.years[i]),
                entityId = variable.entities[i],
                entity = selectedCountriesById[entityId];

            if (!entity) continue;

            var value = valuesByEntity[entityId];

            if (year != targetYear) continue;

            value = {
                time: year,
                x: entityKey[entityId].name,
                y: +variable.values[i],
                key: entityKey[entityId].name,
                entityId: entityId,
                variableId: dimension.variableId
            };

            valuesByEntity[entityId] = value;
        }

        _.each(valuesByEntity, function(value) {
            series.values.push(value);
        });

        series.values = _.sortBy(series.values, 'y');
        chartData.push(series);

		if (chartData.length) {
			legendData = _.map(chartData[0].values, function(v) {
				return { label: v.x, key: v.key, entityId: v.entityId, variableId: v.variableId };
			});
		}

		return { chartData: chartData, legendData: legendData, minYear: targetYear, maxYear: targetYear };
	},    
}