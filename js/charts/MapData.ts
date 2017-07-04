import {computed} from 'mobx'
import MapConfig from './MapConfig'
import VariableData from './VariableData'
import {defaultTo} from './Util'
import * as _ from 'lodash'
import * as d3 from 'd3'
import colorbrewer from './owid.colorbrewer'
import Color from './Color'
import {ChoroplethData} from './ChoroplethMap'
import EntityKey from './EntityKey'

export interface MapDataValue {
    entity: EntityKey,
    value: number|string,
    year: number
}

export class NumericBin {
    index: number
    min: number
    max: number
    color: Color
    label: string
    
    get minText() { return this.min.toString() }
    get maxText() { return this.max.toString() }
    get type() { return 'numeric' }

    contains(d: MapDataValue|null) {
        return d && (this.index == 0 ? d.value >= this.min : d.value > this.min) && d.value <= this.max
    }

    constructor({ index, min, max, label, color }: { index: number, min: number, max: number, label: string, color: Color }) {
        this.index = index
        this.min = min
        this.max = max
        this.color = color
        this.label = label
    }
}

export class CategoricalBin {
    index: number
    value: string
    color: Color
    label: string

    get type() { return 'categorical' }

    contains(d: any) {
        return (d == null && this.value == 'No data') || d.value == this.value
    }

    constructor({ index, value, color, label }: { index: number, value: string, color: Color, label: string }) {
        this.index = index
        this.value = value
        this.color = color
        this.label = label
    }
}

export type MapLegendBin = NumericBin | CategoricalBin

export default class MapData {
    map: MapConfig
    vardata: VariableData

    @computed get variable() {
        return this.map.variableId ? this.vardata.variablesById[this.map.variableId] : _.values(this.vardata.variablesById)[0]
    }

    @computed get years() {
        return this.variable.yearsUniq
    }

    @computed get targetYear() {
        return defaultTo(this.map.props.targetYear, this.variable.years[0])
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

		var minValue = _.floor(variable.minValue, -(rangeMagnitude-1)),
			maxValue = _.ceil(variable.maxValue, -(rangeMagnitude-1));

		var bucketMaximums = [];
		for (var i = 1; i <= numBuckets; i++) {
			var value = minValue + (i/numBuckets)*(maxValue-minValue);
			bucketMaximums.push(_.round(value, -(rangeMagnitude-1)));
		}

		return bucketMaximums;
	}

	@computed get bucketMaximums() {
        if (this.map.isAutoBuckets) return this.autoBucketMaximums

        const {map, variable} = this
        const {minBucketValue, numBuckets, colorSchemeValues} = map

		if (!variable.hasNumericValues || numBuckets <= 0)
			return [];

        let values = _.clone(colorSchemeValues)
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

    // Add default 'No data' category
    @computed get categoricalValues() {
        const {categoricalValues} = this.variable
        if (!_.includes(categoricalValues, "No data"))
            return ["No data"].concat(categoricalValues)
        else
            return categoricalValues
    }

    // Ensure there's always a custom color for "No data"
    @computed get customCategoryColors(): {[key: string]: Color} {
		return _.extend({}, this.map.customCategoryColors, { 'No data': this.map.noDataColor });
    }

    @computed get legendData() {
		// Will eventually produce something like this:
		// [{ type: 'numeric', min: 10, max: 20, minText: "10%", maxText: "20%", color: '#faeaef' },
		//  { type: 'numeric', min: 20, max: 30, minText: "20%", maxText: "30%", color: '#fefabc' },
		//  { type: 'categorical', value: 'Foobar', text: "Foobar Boop", color: '#bbbbbb'}]
		var legendData = [];

        const {map, variable, bucketMaximums, baseColors, categoricalValues, customCategoryColors} = this
        const {isAutoBuckets, customBucketLabels, isCustomColors, customNumericColors, customCategoryLabels, customHiddenCategories, minBucketValue, noDataColor} = map

        /*var unitsString = chart.model.get("units"),
            units = !_.isEmpty(unitsString) ? JSON.parse(unitsString) : {},
            yUnit = _.find(units, { property: 'y' });*/

		// Numeric 'buckets' of color
        var minValue = minBucketValue;
        for (var i = 0; i < bucketMaximums.length; i++) {
            const baseColor = baseColors[i]
            const color = defaultTo(customNumericColors[i], baseColor)
            const maxValue = +bucketMaximums[i]
            const label = customBucketLabels[i] || ""
            legendData.push(new NumericBin({ index: i, min: minValue, max: maxValue, color: color, label: label }))
            minValue = maxValue;
        }

		// Categorical values, each assigned a color
        for (var i = 0; i < categoricalValues.length; i++) {
            var value = categoricalValues[i], boundingOffset = _.isEmpty(bucketMaximums) ? 0 : bucketMaximums.length-1,
                baseColor = baseColors[i+boundingOffset],
                color = customCategoryColors[value] || baseColor,
                label = customCategoryLabels[value] || "",
                text = label || value;

            legendData.push(new CategoricalBin({ value: value, color: color, label: label, hidden: customHiddenCategories[value] }))
        }

        return legendData
    }

    // Get values for the current year, without any color info yet
    @computed get valuesByEntity() {
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
                entity: entities[i],
				year: years[i],
				value: values[i],
			};
		}

		return currentValues
	}

    // Get the final data incorporating the binning colors
    @computed get choroplethData(): ChoroplethData {
        const {valuesByEntity, legendData} = this
        let choroplethData: ChoroplethData = {}

        _.each(valuesByEntity, (datum, entity) => {
            const bin = _.find(legendData, bin => bin.contains(datum))
            if (!bin) return
            choroplethData[entity] = _.extend({}, datum, {                
                color: bin.color,
                highlightFillColor: bin.color
            })
        })

        return choroplethData
    }

    constructor(map: MapConfig, vardata: VariableData) {
        this.map = map
        this.vardata = vardata
    }
}