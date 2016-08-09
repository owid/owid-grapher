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
	owid.namespace("App.Views.ChartURL");

	App.Views.ChartURL = owid.View.extend({
		initialize: function(options) {
			if (App.isEditor) return false; // No URL stuff while editing charts

			// Keep the query params separate between map and the other tabs
			this.lastTabName = null;
			this.mapQueryStr = "?";
			this.chartQueryStr = "?";
			this.originalDefaultTab = App.ChartModel.get("default-tab");

			this.listenTo($(window), "query-change", this.onQueryChange.bind(this));
			this.listenTo(options.dispatcher, "tab-change", this.onTabChange.bind(this));
			this.listenTo(App.ChartModel, "change:selected-countries", this.updateCountryParam.bind(this));	
			this.listenTo(App.ChartModel, "change:activeLegendKeys", this.updateLegendKeys.bind(this));		
			this.listenTo(App.ChartModel, "change-map-year", this.updateYearParam.bind(this));
			this.listenTo(App.ChartModel, "change-map", this.updateMapParams.bind(this));
			this.listenTo(App.ChartModel, "change:currentStackMode", this.updateStackMode.bind(this));
			this.populateFromURL();
		},

		/**
		 * Apply any url query parameters on chart startup
		 */
		populateFromURL: function() {
			var params = owid.getQueryParams();

			// Set tab if specified
			var tab = params.tab;
			if (tab) {
				if (!_.contains(App.ChartModel.get("tabs"), tab))
					console.error("Unexpected tab: " + tab);
				else
					App.ChartModel.set("default-tab", tab, { silent: true });
			}

			var stackMode = params.stackMode;
			if (stackMode !== undefined)
				App.ChartModel.set("currentStackMode", stackMode);

			// Map stuff below

			var year = params.year;
			if (year !== undefined) {
				App.ChartModel.updateMapConfig("defaultYear", year);
			}

			var region = params.region;
			if (region !== undefined) {
				App.ChartModel.updateMapConfig("defaultProjection", region);
			}

			var colorblind = params.colorblind;
			if (colorblind == 1) {
				App.ChartModel.updateMapConfig("isColorblind", true);
			}

			var interpolate = params.interpolate;
			if (interpolate == 0) {
				App.ChartModel.updateMapConfig("mode", "no-interpolation");
			}			

			// TODO: 'country' is currently done server-side, might be more consistent
			// to do them here too - mispy

			// Set shown legend keys for charts with toggleable series
			var shown = params.shown;
			if (_.isString(shown)) {
				var keys = _.map(shown.split("+"), function(key) {
					return decodeURIComponent(key);
				});

				App.ChartModel.set("activeLegendKeys", keys);
			}
		},

		/**
		 * Save the current tab the user is on, and keep url params correctly isolated
		 */
		onTabChange: function(tabName) {
			if (this.lastTabName == "map" && tabName != "map") {
				this.mapQueryStr = window.location.search;
				owid.setQueryStr(this.chartQueryStr);
			} else if (this.lastTabName != "map" && this.lastTabName != null && tabName == "map") {				
				this.chartQueryStr = window.location.search;
				owid.setQueryStr(this.mapQueryStr);
			}
			if (tabName == this.originalDefaultTab)
				owid.setQueryVariable("tab", null);
			else
				owid.setQueryVariable("tab", tabName);
			this.lastTabName = tabName;
		},

		onQueryChange: function() {
		},

		/**
		 * Set e.g. &country=AFG+USA when user adds Afghanistan and the United States
		 * using the legend add country buttons
		 */
		updateCountryParam: function() {
			var selectedEntities = App.ChartModel.get("selected-countries"),
				entityCodes = [];

			App.ChartData.ready(function() {
				// Sort them by name so the order in the url matches the legend
				var sortedEntities = _.sortBy(selectedEntities, function(entity) {
					return entity.name;
				});

				var entityCodes = [];
				_.each(sortedEntities, function(entity) {
					var foundEntity = App.VariableData.getEntityById(entity.id);
					if (!foundEntity) return;
					entityCodes.push(encodeURIComponent(foundEntity.code || foundEntity.name));
				});

				owid.setQueryVariable("country", entityCodes.join("+"));
			});			
		},

		/**
		 * Set e.g. &shown=Africa when the user selects Africa on a stacked area chart or other
		 * toggle-based legend chart.
		 */
		 updateLegendKeys: function() {
		 	var activeLegendKeys = App.ChartModel.get("activeLegendKeys");
		 	if (activeLegendKeys === null)
		 		owid.setQueryVariable("shown", null);
		 	else {
		 		var keys = _.map(activeLegendKeys, function(key) {
		 			return encodeURIComponent(key);
		 		});
		 		owid.setQueryVariable("shown", keys.join("+"));
		 	}
		 },

		/**
		 * Set e.g. &year=1990 when the user uses the map slider to go to 1990
		 */
		updateYearParam: function() {
			var targetYear = App.ChartModel.get("map-config").targetYear;
			owid.setQueryVariable("year", targetYear);
		},

		/**
		 * Store current projection in URL
		 */
		updateMapParams: function() {
			var mapConfig = App.ChartModel.get("map-config");

			var projection = mapConfig.projection;
			owid.setQueryVariable("region", projection);

			var colorblind = mapConfig.isColorblind;
			if (colorblind)
				owid.setQueryVariable("colorblind", 1);
			else
				owid.setQueryVariable("colorblind", null);

			var interpolate = (mapConfig.mode !== "no-interpolation");
			if (interpolate)
				owid.setQueryVariable("interpolate", null);
			else
				owid.setQueryVariable("interpolate", 0);
		},

		/**
		 * Special config for stacked area charts
		 */
		updateStackMode: function() {
			var stackMode = App.ChartModel.get("currentStackMode");
			if (stackMode == "relative" || stackMode == "stacked")
				owid.setQueryVariable("stackMode", stackMode);
			else
				owid.setQueryVariable("stackMode", null);
		},
	});
})();