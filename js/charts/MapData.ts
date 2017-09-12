import {rgb} from 'd3-color'
import {interpolate} from 'd3-interpolate'
import {floor, ceil, round, toArray, keys, isEmpty, clone, reverse, includes, extend, each, find} from './Util'
import {computed, autorun, runInAction, reaction, toJS} from 'mobx'
import ChartConfig from './ChartConfig'
import {defaultTo} from './Util'
import ColorSchemes from './ColorSchemes'
import Color from './Color'
import {ChoroplethData} from './ChoroplethMap'
import {entityNameForMap, formatValue} from './Util'

export interface MapDataValue {
    entity: string,
    value: number|string,
    year: number
}

export class NumericBin {
    index: number
    min: number
    max: number
    color: Color
    label?: string
    isHidden: boolean = false
    format: (v: number) => string
    
    get minText() { return this.format(this.min) }
    get maxText() { return this.format(this.max) }
    get text() { return this.label||"" }

    contains(d: MapDataValue|null): boolean {
        return !!(d && (this.index == 0 ? d.value >= this.min : d.value > this.min) && d.value <= this.max)
    }

    constructor({ index, min, max, label, color, format }: { index: number, min: number, max: number, label?: string, color: Color, format: (v: number) => string }) {
        this.index = index
        this.min = min
        this.max = max
        this.color = color
        this.label = label
        this.format = format
    }
}

export class CategoricalBin {
    index: number
    value: string
    color: Color
    label: string
    isHidden: boolean

    get text() { return this.label || this.value }

    contains(d: MapDataValue|null): boolean {
        return (d == null && this.value == 'No data') || (d != null && d.value == this.value)
    }

    constructor({ index, value, color, label, isHidden }: { index: number, value: string, color: Color, label: string, isHidden: boolean }) {
        this.index = index
        this.value = value
        this.color = color
        this.label = label
        this.isHidden = isHidden
    }
}

export type MapLegendBin = NumericBin | CategoricalBin

export default class MapData {
    chart: ChartConfig
    constructor(chart: ChartConfig) {
        this.chart = chart

        // Validate the map variable id selection to something on the chart
        autorun(() => {
            const hasVariable = chart.map.variableId != null && chart.vardata.variablesById[chart.map.variableId]
            if (!hasVariable && chart.data.primaryVariable) {
                const variableId = chart.data.primaryVariable.id
                runInAction(() => chart.map.props.variableId = variableId)
            }
        })

        // When automatic classification is turned off, assign defaults
        reaction(
            () => this.map.isAutoBuckets,
            () => {
                if (!this.map.isAutoBuckets) {
                    const {autoBucketMaximums} = this
                    let colorSchemeValues = toJS(this.map.props.colorSchemeValues) || []
                    for (var i = 0; i < autoBucketMaximums.length; i++) {
                        if (i >= colorSchemeValues.length)
                            colorSchemeValues.push(autoBucketMaximums[i])
                        else if (colorSchemeValues[i] === undefined)
                            colorSchemeValues[i] = autoBucketMaximums[i]
                    }
                    this.map.props.colorSchemeValues = colorSchemeValues
                }
            }
        )
    }

    @computed get map() { return this.chart.map }
    @computed get vardata() { return this.chart.vardata }

    // Make sure map has an assigned variable and the data is ready
	@computed get isReady(): boolean {
		const {map, vardata} = this
        return map.variableId != null && !!vardata.variablesById[map.variableId]
	}

    @computed get variable() {
        return this.vardata.variablesById[this.map.variableId as number]
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

		var minValue = floor(variable.minValue, -(rangeMagnitude-1)),
			maxValue = ceil(variable.maxValue, -(rangeMagnitude-1));

		var bucketMaximums = [];
		for (var i = 1; i <= numBuckets; i++) {
			var value = minValue + (i/numBuckets)*(maxValue-minValue);
			bucketMaximums.push(round(value, -(rangeMagnitude-1)));
		}

		return bucketMaximums;
	}

	@computed get bucketMaximums() {
        if (this.map.isAutoBuckets) return this.autoBucketMaximums

        const {map, variable} = this
        const {numBuckets, colorSchemeValues} = map

		if (!variable.hasNumericValues || numBuckets <= 0)
			return [];

        let values = toArray(colorSchemeValues)
		while (values.length < numBuckets)
			values.push(0);
		while (values.length > numBuckets)
			values = values.slice(0, numBuckets);
		return values;
	};

    @computed get colorScheme() {
        const {baseColorScheme} = this.map
        return defaultTo(ColorSchemes[baseColorScheme], ColorSchemes[keys(ColorSchemes)[0]])
    }

	@computed get baseColors() {
        const {variable, colorScheme, bucketMaximums} = this
        const {isColorSchemeInverted} = this.map
		const numColors = bucketMaximums.length + variable.categoricalValues.length
        
        let colors: Color[]
		if (!isEmpty(colorScheme.colors[numColors])) {
			colors = clone(colorScheme.colors[numColors]);
		} else if (numColors == 1 && !isEmpty(colorScheme.colors[2])) {
    		// Handle the case of a single color (just for completeness' sake)
			colors = [colorScheme.colors[2][0]];
        } else {
            // If there's no preset color colorScheme for this many colors, improvise a new one
            colors = clone(colorScheme.colors[colorScheme.colors.length-1]);
            while (colors.length < numColors) {
                for (var i = 1; i < colors.length; i++) {
                    var startColor = rgb(colors[i-1]);
                    var endColor = rgb(colors[i]);
                    var newColor = interpolate(startColor, endColor)(0.5);
                    colors.splice(i, 0, newColor);
                    i += 1;

                    if (colors.length >= numColors) break;
                }
            }
        }

        if (isColorSchemeInverted) {
            reverse(colors)
        }

		return colors;
	}

    // Add default 'No data' category
    @computed get categoricalValues() {
        const {categoricalValues} = this.variable
        if (!includes(categoricalValues, "No data"))
            return ["No data"].concat(categoricalValues)
        else
            return categoricalValues
    }

    // Ensure there's always a custom color for "No data"
    @computed get customCategoryColors(): {[key: string]: Color} {
		return extend({}, this.map.customCategoryColors, { 'No data': this.map.noDataColor });
    }

    @computed get legendData() {
		// Will eventually produce something like this:
		// [{ min: 10, max: 20, minText: "10%", maxText: "20%", color: '#faeaef' },
		//  { min: 20, max: 30, minText: "20%", maxText: "30%", color: '#fefabc' },
		//  { value: 'Foobar', text: "Foobar Boop", color: '#bbbbbb'}]
		var legendData = [];

        const {map, variable, bucketMaximums, baseColors, categoricalValues, customCategoryColors} = this
        const {customBucketLabels, customNumericColors, customCategoryLabels, customHiddenCategories, minBucketValue} = map

        /*var unitsString = chart.model.get("units"),
            units = !isEmpty(unitsString) ? JSON.parse(unitsString) : {},
            yUnit = find(units, { property: 'y' });*/

		// Numeric 'buckets' of color
        var minValue = minBucketValue;
        for (var i = 0; i < bucketMaximums.length; i++) {
            const baseColor = baseColors[i]
            const color = defaultTo(customNumericColors[i], baseColor)
            const maxValue = +(bucketMaximums[i] as number)
            const label = customBucketLabels[i]
            legendData.push(new NumericBin({ index: i, min: minValue, max: maxValue, color: color, label: label, format: v => formatValue(v, { unit: variable.shortUnit||""}) }))
            minValue = maxValue;
        }

		// Categorical values, each assigned a color
        for (var i = 0; i < categoricalValues.length; i++) {
            var value = categoricalValues[i], boundingOffset = isEmpty(bucketMaximums) ? 0 : bucketMaximums.length-1,
                baseColor = baseColors[i+boundingOffset],
                color = customCategoryColors[value] || baseColor,
                label = customCategoryLabels[value] || "";

            legendData.push(new CategoricalBin({ index: i, value: value, color: color, label: label, isHidden: customHiddenCategories[value] }))
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
			const entityName = entityNameForMap(entities[i]);            
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

        each(valuesByEntity, (datum, entity) => {
            const bin = find(legendData, bin => bin.contains(datum))
            if (!bin) return
            choroplethData[entity] = extend({}, datum, {                
                color: bin.color,
                highlightFillColor: bin.color
            })
        })

        return choroplethData
    }
}