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

	App.Views.ChartURL = Backbone.View.extend({
		initialize: function(options) {
			if (App.isEditor) return false; // No URL stuff while editing charts

			if (window.location.pathname.match(/.export$/)) {
				$("body").attr("id", "chart-export");
				$(window).on("chart-loaded", function() {
					if (window.callPhantom) window.callPhantom();
					else console.log("Chart loaded!");
				});
			}

			// Keep the query params separate between map and the other tabs
			this.lastTabName = null;
			this.mapQueryStr = "?";
			this.chartQueryStr = "?";

			$(window).on("query-change", this.onQueryChange.bind(this));
			options.dispatcher.on("tab-change", this.onTabChange, this);
			App.ChartModel.on("change:selected-countries", this.updateCountryParam, this);			
			App.ChartModel.on("change-map-year", this.updateYearParam, this);
			App.ChartModel.on("change-map", this.updateMapParams, this);
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
			owid.setQueryVariable("tab", tabName);
			this.lastTabName = tabName;
		},

		/**
		 * When the current url changes, we want to update the permalinks.
		 */
		onQueryChange: function() {
			$(".chart-link-btn").attr("href", window.location.toString());
		},

		/**
		 * Set e.g. &country=AFG+USA when user adds Afghanistan and the United States
		 * using the legend add country buttons
		 */
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
					entityCodes.push(encodeURIComponent(foundEntity.code || foundEntity.name));
				});

				owid.setQueryVariable("country", entityCodes.join("+"));
			});			
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
		}
	});
})();