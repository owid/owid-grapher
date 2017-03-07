/* App.Models.MapModel.js         
 * ================                                                             
 *
 * MapModel holds the data and underlying logic needed by MapTab.
 * It wraps the map-config property on ChartModel.
 *
 * @project Our World In Data
 * @author  Jaiden Mispy                                                     
 * @created 2016-08-08
 */ 

import _ from 'underscore'
import s from 'underscore.string'
import Backbone from 'backbone'

;(function() {
	"use strict";
	owid.namespace("App.Models.MapModel");

	App.Models.MapModel = Backbone.Model.extend({
		defaults: {
			"variableId": -1,
			"targetYear": 1980,
			"targetYearMode": "latest",
			"defaultYear": 1980,
			"mode": "specific",
			"timeTolerance": 1,
			// timeRanges is a collection of objects specifying year ranges e.g.
			//
			// [
			//   { year: 1980 },
			//   { startYear: 1990, endYear: 2000, interval: 5 },
			//   { startYear: 2005, endYear: 2008 }
			// ]
			//
			// Produces the years: 1980, 1990, 1995, 2000, 2005, 2007, 2008
			"timeRanges": [],
			"timelineMode": "slider",
			// Name of an owid.colorbrewer scheme, may then be further customized
			"baseColorScheme": "BuGn",
			// Number of numeric intervals used to color data
			"colorSchemeInterval": 10,
			// Minimum value shown on map legend
			"colorSchemeMinValue": "",
			"colorSchemeValues": [],
			"colorSchemeLabels": [],
			"colorSchemeValuesAutomatic": true,
			// Whether to reverse the color scheme on output
			"colorSchemeInvert": false,
			"customColorsActive": false,
			// e.g. ["#000", "#c00", "#0c0", "#00c", "#c0c"]
			"customNumericColors": [],			
			// e.g. { 'foo' => '#c00' }
			"customCategoryColors": {},
			"customCategoryLabels": {},
			// Allow hiding categories from the legend
			"customHiddenCategories": {},
			"isColorblind": false,
			"projection": "World",
			"defaultProjection": "World",
			"legendDescription": "",
			"legendStepSize": 20,
			"legendOrientation": "portrait",
		},

		bind: function(chartModel) {
			this.chartModel = chartModel;

			this.listenTo(this.chartModel, "change:map-config", this.loadConfig.bind(this));
			this.loadConfig();

			this.on("change", function() {
				this.chartModel.set("map-config", this.toJSON(), { silent: true });
			}.bind(this));

			// Ensure number of colors matches custom color scheme array length
			this.on("change:colorSchemeInterval", function() {
				var colorSchemeName = this.get("colorSchemeName"),
					customColorScheme = _.clone(this.get("customColorScheme")),
					colorSchemeInterval = this.get("colorSchemeInterval");

				if (colorSchemeName == "custom") {
					if (colorSchemeInterval < customColorScheme.length)
						this.set("customColorScheme", customColorScheme.slice(0, colorSchemeInterval));
					else if (colorSchemeInterval > customColorScheme.length) {
						for (var i = customColorScheme.length; i < colorSchemeInterval; i++) {
							customColorScheme.push("#ffffff");
						}
						this.set("customColorScheme", customColorScheme);
					}
				}
			}.bind(this));

			this.on("change:variableId change:timeRanges", this.updateYears.bind(this));
			this.listenTo(App.VariableData, "change:minYear change:maxYear", this.updateYears.bind(this));

			this.on("change:defaultYear", function() {
				this.set('targetYear', this.get('defaultYear'));
			});
		},

		loadConfig: function() {
			var mapConfig = this.chartModel.get("map-config");
			if (!mapConfig) {
				this.chartModel.set("map-config", this.defaults);
				return;
			}

			// Ensure everything that is a number should be
			_.each(this.defaults, function(defaultVal, k) {
				var val = mapConfig[k];
				if (_.isNumber(defaultVal) && _.isString(val))
					mapConfig[k] = +val;
			});

			this.set(mapConfig);
		},

		updateYears: function() {
			var timeRanges = this.get("timeRanges"),
				variable = this.getVariable(),
				minVariableYear = variable ? _.first(variable.years) : 0,
				maxVariableYear = variable ? _.last(variable.years) : 2000,
				defaultYear = this.get("defaultYear"),
				targetYear = this.get("targetYear");
			
			this.years = owid.timeRangesToYears(timeRanges, minVariableYear, maxVariableYear);

			var minYear = this.getMinYear(),
				maxYear = this.getMaxYear();

			// Sanity check our target years
			if (defaultYear < minYear)
				this.set("defaultYear", minYear);
			else if (defaultYear > maxYear)
				this.set("defaultYear", maxYear);

			if (targetYear < minYear)
				this.set("targetYear", minYear);
			else if (targetYear > maxYear)
				this.set("targetYear", maxYear);

			// Update min and max values
			this.minValue = Infinity;
			this.maxValue = -Infinity;
			if (variable && variable.isNumeric) {
				_.each(variable.values, function(value, i) {
					var year = variable.years[i];
					if (_.contains(this.years, year)) {
						var entity = App.VariableData.getEntityById(variable.entities[i]);

						// If there's a World or other meta entity, it can throw off the map calcs
						if (entity.code && !s.startsWith(entity.code, "OWID")) {						
							if (value < this.minValue) this.minValue = value;
							if (value > this.maxValue) this.maxValue = value;
						}
					}
				}.bind(this));				
			}
		},

		getYears: function() {
			return this.years;
		},	

		getMinYear: function() {
			return this.years[0];
		},

		getMaxYear: function() {
			return this.years[this.years.length-1];
		},

		getMinValue: function() {
			return this.minValue;
		},

		getMaxValue: function() {
			return this.maxValue;
		},

		getVariable: function() {
			return App.VariableData.getVariableById(this.get("variableId"));
		},

		getLegendMin: function() {
			var minValue = this.get('colorSchemeMinValue');
			if (parseFloat(minValue) != minValue) return -Infinity;
			else return +minValue;
		},

		// Generate colors for map
		// If color scheme is customized, we simply return the stored custom data
		getColors: function(mapConfig) {
			mapConfig = mapConfig || _.clone(this.attributes);
			var	variable = App.MapModel.getVariable(),
				hasNumeric = variable.hasNumericValues,
				hasCategorical = variable.hasCategoricalValues,
				isOnlyNumeric = hasNumeric && !hasCategorical,
				isColorblind = mapConfig.isColorblind,
				colorSchemeName = (isColorblind ? "RdYlBu" : mapConfig.colorSchemeName) || "",
				colorSchemeInterval = mapConfig.colorSchemeInterval || 2,
				colorSchemeInvert = mapConfig.colorSchemeInvert || false,
				customColorScheme = mapConfig.customColorScheme || [],
				numColors = isOnlyNumeric ? colorSchemeInterval : variable.categoricalValues.length;

			if (colorSchemeInvert) {
				var colors = this.getColors(_.extend({}, mapConfig, { colorSchemeInvert: false }));
				return colors.reverse();
			}

			if (colorSchemeName === "custom")
				return _.clone(customColorScheme);

			var scheme = owid.colorbrewer[colorSchemeName];
			if (!scheme) {
				console.error("No such color scheme: " + scheme);
				// Return a default color scheme
				return this.getColors(_.extend({}, mapConfig, { colorSchemeName: _.keys(owid.colorbrewer)[0] }));
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
		},
	});
})();