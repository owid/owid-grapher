;(function() {	
	"use strict";
	owid.namespace("owid.models.mapdata");

	owid.models.mapdata = function(chart) {
		function mapdata() { }		
		var changes = owid.changes();
		changes.track(chart.vardata);
		changes.track(chart.map);

		function updateLegendData() {
/*			if (showOnlyRelevant) {
				// Only show the colors that are actually on the map right now
				var values = _.sortBy(_.uniq(_.map(chart.mapdata.currentValues, function(d) { return d.value; })));
				colorScheme = _.map(values, function(v) { return colorScale(v); });
				colorScale.domain(values);
				colorScale.range(colorScheme);
			}				*/


			// Will eventually produce something like this:
			// [{ type: 'numeric', min: 10, max: 20, minText: "10%", maxText: "20%", color: '#faeaef' },
			//  { type: 'numeric', min: 20, max: 30, minText: "20%", maxText: "30%", color: '#fefabc' },
			//  { type: 'categorical', value: 'Foobar', text: "Foobar Boop", color: '#bbbbbb'}]
			var legendData = [];

			var variable = chart.map.getVariable(),
				boundingValues = chart.map.get('colorSchemeValues') || [],
				boundingLabels = chart.map.get('colorSchemeLabels') || [],
				categoricalValues = variable.categoricalValues,
				numColorsNeeded = chart.map.getNumIntervals() + variable.categoricalValues.length,
				baseColors = getColors(numColorsNeeded),
				customColorsActive = chart.map.get('customColorsActive'),
				customNumericColors = (customColorsActive && chart.map.get('customNumericColors')) || [],
				customCategoryColors = (customColorsActive && chart.map.get('customCategoryColors')) || {},
				customCategoryLabels = chart.map.get('customCategoryLabels') || {};

			// Numeric 'buckets' of color
			if (!_.isEmpty(boundingValues)) {
				for (var i = 0; i < boundingValues.length-1; i++) {
					var baseColor = baseColors[i],
						color = customNumericColors[i] || baseColor,
						minValue = boundingValues[i],
						maxValue = boundingValues[i+1],
						minLabel = boundingLabels[i] || "",
						maxLabel = boundingLabels[i+1] || "",
						minText = minLabel || minValue,
						maxText = maxLabel || maxValue;
					legendData.push({ type: 'numeric', 
									  min: minValue, max: maxValue,
									  minLabel: minLabel, maxLabel: maxLabel, 
									  minText: minText, maxText: maxText, 
									  baseColor: baseColor, color: color });
				}
			}

			// Add default 'No data' category
			if (!_.contains(categoricalValues, 'No data')) categoricalValues.push('No data');			
			customCategoryColors = _.extend({}, customCategoryColors, { 'No data': mapdata.getNoDataColor() });

			// Categorical values, each assigned a color
			if (!_.isEmpty(categoricalValues)) {
				for (var i = 0; i < categoricalValues.length; i++) {
					var value = categoricalValues[i], boundingOffset = _.isEmpty(boundingValues) ? 0 : boundingValues.length-1,
						baseColor = baseColors[i+boundingOffset],
						color = customCategoryColors[value] || baseColor,
						label = customCategoryLabels[value] || "",
						text = label || value;
					legendData.push({ type: 'categorical', value: value, baseColor: baseColor, color: color, label: label, text: text });
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
			if (!changes.any('variables entityKey variableId targetYear timeTolerance mode'))
				return;

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
			return customCategoryColors['No data'] || "#8b8b8b";
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