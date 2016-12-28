;(function() {	
	"use strict";
	owid.namespace("owid.models.mapdata");

	owid.models.mapdata = function(chart) {
		function mapdata() { }		
		var changes = owid.changes();
		changes.track(chart.vardata);
		changes.track(chart.map);

		// When automatic classification is turned on, this takes the numeric map data
		// and works out some discrete ranges to assign colors to
		function calculateIntervalMaximums() {
			var variable = chart.map.getVariable(),
				numIntervals = +chart.map.get('colorSchemeInterval');
			if (!variable.hasNumericValues || numIntervals <= 0) return [];

			var rangeValue = variable.maxValue - variable.minValue,
				rangeMagnitude = Math.floor(Math.log(rangeValue) / Math.log(10));

			var minValue = owid.floor(variable.minValue, -(rangeMagnitude-1)),
				maxValue = owid.ceil(variable.maxValue, -(rangeMagnitude-1));

			var intervalMaximums = [];
			for (var i = 1; i <= numIntervals; i++) {
				var value = minValue + (i/numIntervals)*(maxValue-minValue);
				intervalMaximums.push(owid.round(value, -(rangeMagnitude-1)));
			}

			return intervalMaximums;
		}

		mapdata.getIntervalMaximums = function() {
			var automaticValues = chart.map.get('colorSchemeValuesAutomatic');
			if (automaticValues) return calculateIntervalMaximums();

			var variable = chart.map.getVariable(),
				minValue = chart.map.get('colorSchemeMinValue'),
				numIntervals = +chart.map.get('colorSchemeInterval'),
				values = chart.map.get('colorSchemeValues')||[];

			if (!variable.hasNumericValues || numIntervals <= 0)
				return [];

			while (values.length < numIntervals)
				values.push(0);
			while (values.length > numIntervals)
				values = values.slice(0, numIntervals);
			return values;
		};

		function updateLegendData() {
			// Will eventually produce something like this:
			// [{ type: 'numeric', min: 10, max: 20, minText: "10%", maxText: "20%", color: '#faeaef' },
			//  { type: 'numeric', min: 20, max: 30, minText: "20%", maxText: "30%", color: '#fefabc' },
			//  { type: 'categorical', value: 'Foobar', text: "Foobar Boop", color: '#bbbbbb'}]
			var legendData = [];

			var variable = chart.map.getVariable(),
				automaticBuckets = chart.map.get('colorSchemeValuesAutomatic'),
				intervalMaximums = mapdata.getIntervalMaximums(),
				intervalLabels = chart.map.get('colorSchemeLabels'),
				categoricalValues = _.clone(variable.categoricalValues),
				numColorsNeeded = intervalMaximums.length + variable.categoricalValues.length,
				baseColors = getColors(numColorsNeeded),
				customColorsActive = chart.map.get('customColorsActive'),
				customNumericColors = (customColorsActive && chart.map.get('customNumericColors')) || [],
				customCategoryColors = (customColorsActive && chart.map.get('customCategoryColors')) || {},
				customCategoryLabels = chart.map.get('customCategoryLabels'),
				showOnlyRelevant = variable.categoricalValues.length > 8,
				customHiddenCategories = chart.map.get('customHiddenCategories');

            var unitsString = chart.model.get("units"),
                units = !_.isEmpty(unitsString) ? JSON.parse(unitsString) : {},
                yUnit = _.findWhere(units, { property: 'y' });

			// Numeric 'buckets' of color
			if (!_.isEmpty(intervalMaximums)) {
				var minValue = chart.map.get('colorSchemeMinValue');
				if (minValue == null) minValue = "";

				for (var i = 0; i < intervalMaximums.length; i++) {
					var baseColor = baseColors[i],
						color = customNumericColors[i] || baseColor,
						maxValue = +intervalMaximums[i],
						label = intervalLabels[i] || "",
						minText = owid.unitFormat(yUnit, minValue),
						maxText = owid.unitFormat(yUnit, maxValue);

					// HACK - Todo replace this with an option to actually choose whether to use units
					if (maxText.length-maxValue.toString().length > 8)
						maxText = maxValue.toString();

					if (minText.length-minValue.toString().length > 8)
						minText = minValue.toString();

					legendData.push({ type: 'numeric', 
									  min: _.isFinite(+minValue) ? +minValue : -Infinity, max: maxValue,
									  minText: minText, maxText: maxText, 
									  label: label, text: label, baseColor: baseColor, color: color });
					minValue = maxValue;
				}
			}

			if (showOnlyRelevant) {
				var relevantValues = {};
				_.each(mapdata.currentValues, function(d) {
					relevantValues[d.value] = true;
				});
				customHiddenCategories = _.extend({}, customHiddenCategories);
				_.each(categoricalValues, function(v) { if (!relevantValues[v]) customHiddenCategories[v] = true; });
			}

			// Add default 'No data' category
			if (!_.contains(categoricalValues, 'No data')) categoricalValues.push('No data');			
			customCategoryColors = _.extend({}, customCategoryColors, { 'No data': mapdata.getNoDataColor() });

			// Categorical values, each assigned a color
			if (!_.isEmpty(categoricalValues)) {
				for (var i = 0; i < categoricalValues.length; i++) {					
					var value = categoricalValues[i], boundingOffset = _.isEmpty(intervalMaximums) ? 0 : intervalMaximums.length-1,
						baseColor = baseColors[i+boundingOffset],
						color = customCategoryColors[value] || baseColor,
						label = customCategoryLabels[value] || "",
						text = label || value;

					legendData.push({ type: 'categorical', value: value, baseColor: baseColor, color: color, label: label, text: text, hidden: customHiddenCategories[value] });
				}
			}

			mapdata.legendTitle = chart.map.get('legendDescription') || chart.map.getVariable().name;
			mapdata.legendData = legendData;
		}

		function getColors(numColors, mapConfig) {
			mapConfig = mapConfig || _.clone(chart.map.attributes);
			var	variable = chart.map.getVariable(),
				hasNumeric = variable.hasNumericValues,
				isColorblind = mapConfig.isColorblind,
				colorSchemeName = (isColorblind ? "RdYlBu" : mapConfig.baseColorScheme) || "",
				colorSchemeInvert = mapConfig.colorSchemeInvert || false;

			if (colorSchemeInvert) {
				var colors = getColors(numColors, _.extend({}, mapConfig, { colorSchemeInvert: false }));
				return colors.reverse();
			}

			var scheme = owid.colorbrewer[colorSchemeName];
			if (!scheme) {
				console.error("No such color scheme: " + scheme);
				// Return a default color scheme
				return getColors(numColors, _.extend({}, mapConfig, { colorSchemeName: _.keys(owid.colorbrewer)[0] }));
			}

			if (!_.isEmpty(scheme.colors[numColors]))
				return _.clone(scheme.colors[numColors]);

			// Handle the case of a single color (just for completeness' sake)
			if (numColors == 1 && !_.isEmpty(scheme.colors[2]))
				return [scheme.colors[2][0]];

			// If there's no preset color scheme for this many colors, improvise a new one
			var colors = _.clone(scheme.colors[scheme.colors.length-1]);
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

		function applyLegendColors() {
			var values = mapdata.currentValues,
				legendData = mapdata.legendData;

			_.each(values, function(d) {
				delete d.color;
				delete d.highlightFillColor;

				_.each(legendData, function(l) {
					if (d.color) return;

					if (d.value == l.value || (l.type === 'numeric' && _.isNumber(d.value) && d.value >= l.min && d.value <= l.max)) {
						d.color = l.color;
						d.highlightFillColor = l.color;
					}
				});
			});
		}

		// Transforms raw variable data into datamaps format with meta information 
		// specific to the current target year + tolerance
		function updateCurrentValues() {
			var variable = chart.map.getVariable(),
				entityKey = chart.vardata.get("entityKey"),
				mapConfig = chart.map.attributes;

			var years = variable.years,
				values = variable.values,
				entities = variable.entities,
				targetYear = +mapConfig.targetYear,
				tolerance = +mapConfig.timeTolerance,
			  	currentValues = {};

			if (isNaN(tolerance))
				tolerance = 0;

			if (mapConfig.mode === "no-interpolation")
				tolerance = 0;

			for (var i = 0; i < values.length; i++) {
				var year = years[i];
				if (year < targetYear-tolerance || year > targetYear+tolerance) 
					continue;

				// Make sure we use the closest year within tolerance (favoring later years)
				var existing = currentValues[entityName];
				if (existing && Math.abs(existing.year - targetYear) < Math.abs(year - targetYear))
					continue;

				var entityName = owid.entityNameForMap(entityKey[entities[i]].name);

				currentValues[entityName] = {
					value: values[i],
					year: years[i]
				};
			}

			mapdata.minCurrentValue = _.min(currentValues, function(d, i) { return d.value; }).value;
			mapdata.maxCurrentValue = _.max(currentValues, function(d, i) { return d.value; }).value;
			mapdata.minToleranceYear = _.min(currentValues, function(d, i) { return d.year; }).year;
			mapdata.maxToleranceYear = _.max(currentValues, function(d, i) { return d.year; }).year;
			mapdata.currentValues = currentValues;
		}

		// Get the color for "No data", which may be customized
		mapdata.getNoDataColor = function() {
			var customCategoryColors = chart.map.get('customCategoryColors');
			return customCategoryColors['No data'] || "#adacac";
		};

		mapdata.update = function() {
			if (!chart.map.getVariable()) return;
			if (!changes.start()) return;

			updateCurrentValues();
			updateLegendData();
			applyLegendColors();
			changes.done();
		};
		
		return mapdata;
	};
})();