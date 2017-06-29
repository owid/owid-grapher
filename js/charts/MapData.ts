import {computed} from 'mobx'
import MapConfig from './MapConfig'
import VariableData from './VariableData'
import {defaultTo} from './Util'
import * as _ from 'lodash'
import * as d3 from 'd3'
import colorbrewer from './owid.colorbrewer'

export interface MapDataValue {
    value: number|string,
    year: number
}

export default class MapData {
    map: MapConfig
    vardata: VariableData

    @computed get variable() {
        return this.vardata.variablesById[this.map.variableId]
    }

    @computed get years() {
        return this.variable.yearsUniq
    }

    @computed get targetYear() {
        return defaultTo(this.map.targetYear, this.variable.years[0])
    }

    @computed get legendTitle() {
        return defaultTo(this.map.props.legendDescription, this.variable.name)
    }    

	// When automatic classification is turned on, this takes the numeric map data
	// and works out some discrete ranges to assign colors to
	@computed get autoBucketMaximums() {
        const {map, variable} = this
        const {numBuckets} = map

		if (!variable.hasNumericValues || numBuckets <= 0) return [];

		var rangeValue = variable.maxValue - variable.minValue,
			rangeMagnitude = Math.floor(Math.log(rangeValue) / Math.log(10));

		var minValue = owid.floor(variable.minValue, -(rangeMagnitude-1)),
			maxValue = owid.ceil(variable.maxValue, -(rangeMagnitude-1));

		var bucketMaximums = [];
		for (var i = 1; i <= numBuckets; i++) {
			var value = minValue + (i/numBuckets)*(maxValue-minValue);
			bucketMaximums.push(owid.round(value, -(rangeMagnitude-1)));
		}

		return bucketMaximums;
	}

	@computed get bucketMaximums() {
        if (this.map.isAutoBuckets) return this.autoBucketMaximums

        const {map, variable} = this
        const {minBucketValue, numBuckets, colorSchemeValues} = map

		if (!variable.hasNumericValues || numBuckets <= 0)
			return [];

        let values = []
		while (values.length < numBuckets)
			values.push(0);
		while (values.length > numBuckets)
			values = values.slice(0, numBuckets);
		return values;
	};

    @computed get colorScheme() {
        const {baseColorScheme} = this.map
        return defaultTo(colorbrewer[baseColorScheme], colorbrewer[_.keys(colorbrewer[0])])
    }

	@computed get baseColors() {
        const {variable, colorScheme, bucketMaximums} = this
        const {isColorSchemeInverted} = this.map
		const numColors = bucketMaximums.length + variable.categoricalValues.length
        

		/*if (colorSchemeInvert) {
			var colors = getColors(numColors, _.extend({}, mapConfig, { colorSchemeInvert: false }));
			return colors.reverse();
		}*/

		if (!_.isEmpty(colorScheme.colors[numColors]))
			return _.clone(colorScheme.colors[numColors]);

		// Handle the case of a single color (just for completeness' sake)
		if (numColors == 1 && !_.isEmpty(colorScheme.colors[2]))
			return [colorScheme.colors[2][0]];

		// If there's no preset color colorScheme for this many colors, improvise a new one
		var colors = _.clone(colorScheme.colors[colorScheme.colors.length-1]);
		while (colors.length < numColors) {
			for (var i = 1; i < colors.length; i++) {
				var startColor = d3.rgb(colors[i-1]);
				var endColor = d3.rgb(colors[i]);
				var newColor = d3.interpolate(startColor, endColor)(0.5);
				colors.splice(i, 0, newColor);
				i += 1;

				if (colors.length >= numColors) break;
			}
		}
		return colors;
	}


    @computed get legendData() {
		// Will eventually produce something like this:
		// [{ type: 'numeric', min: 10, max: 20, minText: "10%", maxText: "20%", color: '#faeaef' },
		//  { type: 'numeric', min: 20, max: 30, minText: "20%", maxText: "30%", color: '#fefabc' },
		//  { type: 'categorical', value: 'Foobar', text: "Foobar Boop", color: '#bbbbbb'}]
		var legendData = [];

        const {map, variable, bucketMaximums, baseColors} = this
        const {isAutoBuckets, customBucketLabels, isCustomColors, customNumericColors, customCategoryLabels, customHiddenCategories, minBucketValue, noDataColor} = map
        let customCategoryColors = _.clone(map.customCategoryColors)
		let categoricalValues = _.clone(variable.categoricalValues)

        /*var unitsString = chart.model.get("units"),
            units = !_.isEmpty(unitsString) ? JSON.parse(unitsString) : {},
            yUnit = _.find(units, { property: 'y' });*/

		// Numeric 'buckets' of color
		if (!_.isEmpty(bucketMaximums)) {
			var minValue = minBucketValue;
			if (!_.isFinite(parseFloat(minValue))) minValue = 0;

			for (var i = 0; i < bucketMaximums.length; i++) {
				const baseColor = baseColors[i]
				const color = defaultTo(customNumericColors[i], baseColor)
				const maxValue = +bucketMaximums[i]
				const label = customBucketLabels[i] || ""
				const minText = minValue.toString()//owid.unitFormat(yUnit, minValue),
				const maxText = maxValue.toString()//owid.unitFormat(yUnit, maxValue);

				legendData.push({ type: 'numeric',
								  min: _.isFinite(parseFloat(minValue)) ? +minValue : -Infinity, max: maxValue,
								  minText: minText, maxText: maxText,
								  label: label, text: label, baseColor: baseColor, color: color,
                                  index: i,
                                  contains: function(d) {
                                    return d && (this.index == 0 ? d.value >= this.min : d.value > this.min) && d.value <= this.max
                                  }});
				minValue = maxValue;
			}
		}

		// Add default 'No data' category
		if (!_.includes(categoricalValues, 'No data')) categoricalValues.push('No data');
		customCategoryColors = _.extend({}, customCategoryColors, { 'No data': noDataColor });

		// Categorical values, each assigned a color
		if (!_.isEmpty(categoricalValues)) {
			for (var i = 0; i < categoricalValues.length; i++) {
				var value = categoricalValues[i], boundingOffset = _.isEmpty(bucketMaximums) ? 0 : bucketMaximums.length-1,
					baseColor = baseColors[i+boundingOffset],
					color = customCategoryColors[value] || baseColor,
					label = customCategoryLabels[value] || "",
					text = label || value;

				legendData.push({ type: 'categorical', value: value, baseColor: baseColor, color: color, label: label, text: text, hidden: customHiddenCategories[value], contains: function(d) {
                    return (d == null && value == 'No data') || d.value == this.value
                }});
			}
		}

        return legendData
    }

    // Get values for the current year
    @computed get currentValuesByEntity() {
        const {map, variable, targetYear} = this
        const {tolerance} = map
        const {years, values, entities} = variable
		let currentValues: {[key: string]: MapDataValue} = {};

		for (var i = 0; i < values.length; i++) {
			var year = years[i];
			if (year < targetYear-tolerance || year > targetYear+tolerance)
				continue;

			// Make sure we use the closest year within tolerance (favoring later years)
			const entityName = owid.entityNameForMap(entities[i]);            
			const existing = currentValues[entityName];
			if (existing && Math.abs(existing.year - targetYear) < Math.abs(year - targetYear))
				continue;

			currentValues[entityName] = {
				value: values[i],
				year: years[i]
			};
		}

		/*if (currentValues.length) {
			mapdata.minCurrentValue = _.minBy(_.values(currentValues), function(d, i) { return d.value; }).value;
			mapdata.maxCurrentValue = _.maxBy(_.values(currentValues), function(d, i) { return d.value; }).value;
			mapdata.minToleranceYear = _.minBy(_.values(currentValues), function(d, i) { return d.year; }).year;
			mapdata.maxToleranceYear = _.maxBy(_.values(currentValues), function(d, i) { return d.year; }).year;
		}*/
		return currentValues
	}    

    constructor(map: MapConfig, vardata: VariableData) {
        this.map = map
        this.vardata = vardata
    }
}