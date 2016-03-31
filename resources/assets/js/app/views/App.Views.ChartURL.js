/* App.Views.ChartURL.js                                                             
 * ================                                                             
 *
 * This view is responsible for handling data binding between the
 * the chart and url parameters, to enable nice linking support
 * for specific countries and years.
 *
 * @project Our World In Data
 * @author  Jaiden Mispy                                                     
 * @created 2016-03-31
 */ 

;(function() {
	"use strict";

	window.App = window.App || {};
	App.Views = App.Views || {};

	App.Views.ChartURL = Backbone.View.extend({
		initialize: function() {
			if (App.isEditor) return false; // No URL stuff while editing charts

			App.ChartModel.on("change:selected-countries", this.updateCountryParam, this);
		},

		updateCountryParam: function() {
			var selectedCountries = App.ChartModel.get("selected-countries"),
				entityCodes = [];

			App.DataModel.ready(function(variableData) {
				// Sort them by name so the order in the url matches the legend
				var sortedCountries = _.sortBy(selectedCountries, function(entity) {
					return entity.name;
				});

				var entityCodes = [];
				_.each(sortedCountries, function(entity) {
					var foundEntity = variableData.entityKey[entity.id];
					if (!foundEntity) return;
					entityCodes.push(foundEntity.code || foundEntity.name);
				});

				owid.setQueryVariable("country", entityCodes.join("+"));
			});			
		}
	});

	$(document).ready(function() {
		App.ChartURL = new App.Views.ChartURL();
	});
})();