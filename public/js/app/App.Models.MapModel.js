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


;(function() {
	"use strict";
	owid.namespace("App.Models.MapModel");

	App.Models.MapModel = Backbone.Model.extend({
		defaults: {
			"variableId": -1,
			"targetYear": 1980,
			"targetYearMode": "normal",
			"defaultYear": 1980,
			"mode": "specific",
			"timeTolerance": 1,
			"minYear": 1980,
			"maxYear": 2000,
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
			"colorSchemeName": "BuGn",
			"colorSchemeValues": false,
			"colorSchemeLabels": [],
			"colorSchemeValuesAutomatic": true,
			"colorSchemeInterval": 5,
			// Whether to reverse the color scheme on output
			"colorSchemeInvert": false,
			"colorSchemeMinValue": null,
			// e.g. ["#000", "#c00", "#0c0", "#00c", "#c0c"]
			"customColorScheme": [],
			"isColorblind": false,
			"projection": "World",
			"defaultProjection": "World",
			"legendDescription": "",
			"legendStepSize": 20,
			"legendOrientation": "portrait",
		},

		bind: function(chartModel) {
			this.chartModel = chartModel;

			this.set(this.chartModel.get("map-config"));

			this.listenTo(this.chartModel, "change:map-config", function() {
				this.set(this.chartModel.get("map-config"));
			}.bind(this));
			this.on("change", function() {
				this.chartModel.set("map-config", this.toJSON());
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
		},

		getVariable: function() {
			return App.VariableData.getVariableById(this.get("variableId"));
		},

		getColors: function() {
			return owdColorbrewer.getColors(this.toJSON());
		},

		showOnlyRelevantLegend: function() {
			var variable = this.getVariable();
			return !variable.isNumeric && variable.uniqueValues.length > 8;
		}
	});
})();