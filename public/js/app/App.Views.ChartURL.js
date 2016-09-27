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
	owid.namespace("owid.view.urlBinder");

	owid.view.urlBinder = function() {
		function urlBinder() { }

		// Keep the query params separate between map and the other tabs
		var lastTabName = null,
			mapQueryStr = '?',
			chartQueryStr = '?',
			originalDefaultTab = chart.model.get('default-tab');

		function initialize() {
			if (App.isEditor) return;

			chart.display.on("change:activeTab", onTabChange);
			chart.model.on("change:selected-countries", updateCountryParam);	
			chart.model.on("change:activeLegendKeys", updateLegendKeys);		
			chart.map.on("change:targetYear", updateYearParam);
			chart.map.on("change:mode change:projection change:isColorblind", updateMapParams);
			chart.model.on("change:currentStackMode", updateStackMode);
			populateFromURL();

			$(window).on('message', function(event) {
				var msg = event.originalEvent.data;
				if (msg.event != 'urlUpdate') return;
				urlBinder.update(msg.url);
			});
		}

		/**
		 * Update to a new url. Fast way of communicating desired state change
		 */
		urlBinder.update = function(url) {
			var parser = document.createElement('a');
			parser.href = url;
			owid.setQueryStr(parser.search);
			populateFromURL();
		};

		/**
		 * Apply any url query parameters on chart startup
		 */
		function populateFromURL() {
			var params = owid.getQueryParams();

			// Set tab if specified
			var tab = params.tab;
			if (tab) {
				if (!_.contains(chart.model.get("tabs"), tab))
					console.error("Unexpected tab: " + tab);
				else {
					chart.display.set('activeTab', tab);
				}
			} else {
				chart.display.set('activeTab', chart.model.get('default-tab'));
			}

			var stackMode = params.stackMode;
			if (stackMode !== undefined)
				chart.model.set("currentStackMode", stackMode);

			// Map stuff below

			var year = params.year;
			if (year !== undefined) {
				chart.map.set("defaultYear", year);
			}

			var region = params.region;
			if (region !== undefined) {
				chart.map.set("defaultProjection", region);
			}

			var colorblind = params.colorblind;
			if (colorblind == 1) {
				chart.map.set("isColorblind", true);
			}

			var interpolate = params.interpolate;
			if (interpolate == 0) {
				chart.map.set("mode", "no-interpolation");
			}			

			// Selected countries -- we can't actually look these up until we have the data
			/*chart.data.ready(function() {
				var country = params.country;
				if (country) {
					var codesOrNames = country.split('+'),
						entities = _.filter(chart.vardata.get('availableEntities'), function(entity) {
						return _.include(codesOrNames, entity.code) || _.include(codesOrNames, entity.name);
					});

					chart.model.set('selected-countries', entities);
				}				
			});*/

			// Set shown legend keys for charts with toggleable series
			var shown = params.shown;
			if (_.isString(shown)) {
				var keys = _.map(shown.split("+"), function(key) {
					return decodeURIComponent(key);
				});

				chart.model.set("activeLegendKeys", keys);
			}
		}

		/**
		 * Save the current tab the user is on, and keep url params correctly isolated
		 */
		function onTabChange() {
			var tabName = chart.display.get('activeTab');

			if (lastTabName == "map" && tabName != "map") {
				mapQueryStr = window.location.search;
				owid.setQueryStr(chartQueryStr);
			} else if (lastTabName != "map" && lastTabName != null && tabName == "map") {				
				chartQueryStr = window.location.search;
				owid.setQueryStr(mapQueryStr);
			}
			if (tabName == originalDefaultTab)
				owid.setQueryVariable("tab", null);
			else
				owid.setQueryVariable("tab", tabName);
			lastTabName = tabName;
		}

		/**
		 * Set e.g. &country=AFG+USA when user adds Afghanistan and the United States
		 * using the legend add country buttons
		 */
		function updateCountryParam() {
			var selectedEntities = chart.model.get("selected-countries"),
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
		}

		/**
		 * Set e.g. &shown=Africa when the user selects Africa on a stacked area chart or other
		 * toggle-based legend chart.
		 */
		function updateLegendKeys() {
		 	var activeLegendKeys = chart.model.get("activeLegendKeys");
		 	if (activeLegendKeys === null)
		 		owid.setQueryVariable("shown", null);
		 	else {
		 		var keys = _.map(activeLegendKeys, function(key) {
		 			return encodeURIComponent(key);
		 		});
		 		owid.setQueryVariable("shown", keys.join("+"));
		 	}
		 }

		/**
		 * Set e.g. &year=1990 when the user uses the map slider to go to 1990
		 */
		function updateYearParam() {
			if (chart.display.get('activeTab') == 'map')
				owid.setQueryVariable("year", chart.map.get("targetYear"));
		}

		/**
		 * Store current projection in URL
		 */
		function updateMapParams() {
			var mapConfig = chart.map.attributes;

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

		/**
		 * Special config for stacked area charts
		 */
		function updateStackMode() {
			var stackMode = chart.model.get("currentStackMode");
			if (stackMode == "relative" || stackMode == "stacked")
				owid.setQueryVariable("stackMode", stackMode);
			else
				owid.setQueryVariable("stackMode", null);
		}

		initialize();
		return urlBinder;
	};
})();