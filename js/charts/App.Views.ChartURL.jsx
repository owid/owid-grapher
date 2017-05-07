/* owid.component.urlBinder.js
 * ================
 *
 * This component is responsible for handling data binding between the
 * the chart and url parameters, to enable nice linking support
 * for specific countries and years.
 *
 * @project Our World In Data
 * @author  Jaiden Mispy
 * @created 2016-03-31
 */

import _ from 'lodash'
import $ from 'jquery'
import owid from '../owid'
import {autorun} from 'mobx'

export default function(chart) {
	function urlBinder() { }

	// Keep the query params separate between map and the other tabs
	var lastTabName = null,
		originalDefaultTab = chart.model.get('default-tab'),
		originalXAxisScale = chart.model.getAxisConfig('x-axis', 'axis-scale'),
		originalYAxisScale = chart.model.getAxisConfig('y-axis', 'axis-scale');

	urlBinder.mapQueryStr = '?';
	urlBinder.chartQueryStr = '?';

	var origConfig = null;

	function initialize() {
		if (chart.isEditor) {
			chart.update({ activeTabName: chart.model.get('default-tab') });
			return;
		}

		origConfig = _.clone(chart.model.attributes);

        autorun(() => onTabChange())

		chart.model.on("change:selected-countries", updateCountryParam);
		chart.model.on("change:activeLegendKeys", updateLegendKeys);
		chart.map.on("change:targetYear", updateYearParam);
		chart.map.on("change:mode change:projection change:isColorblind", updateMapParams);
		chart.model.on("change:currentStackMode", updateStackMode);
		chart.model.on("change:x-axis", updateAxisScales);
		chart.model.on("change:y-axis", updateAxisScales);
		chart.model.on("change:chart-time", updateTime);
		populateFromURL();

		$(window).on('query-change', function() {
			var tabName = chart.activeTabName;
			if (tabName == 'chart' || tabName == 'map')
				urlBinder.lastQueryStr = window.location.search;
		});
	};

	/**
	 * Apply any url parameters on chart startup
	 */
	function populateFromURL() {
		var params = owid.getQueryParams();

		// Set tab if specified
		var tab = params.tab;
		if (tab) {
			if (!_.includes(chart.model.get("tabs").concat('share'), tab) && tab !== 'download')
				console.error("Unexpected tab: " + tab);
			else {
				chart.activeTabName = tab
			}
		} else {
			chart.activeTabName = chart.model.get('default-tab')
		}

		// Affiliate logo if any
		var logo = params.logo;
		if (logo) {
			chart.model.set('second-logo', '/logo/' + params.logo + '.png');
		}

		// Stack mode for bar and stacked are charts
		var stackMode = params.stackMode;
		if (stackMode !== undefined)
			chart.model.set("currentStackMode", stackMode);

		// Axis scale mode
		var xAxisScale = params.xScale;
		if (xAxisScale !== undefined)
			chart.model.setAxisConfig('x-axis', 'axis-scale', xAxisScale);

		var yAxisScale = params.yScale;
		if (yAxisScale !== undefined)
			chart.model.setAxisConfig('y-axis', 'axis-scale', yAxisScale);

		var time = params.time;
		if (time !== undefined) {
            const m = time.match(/^(\d+)\.\.(\d+)$/)
            if (m) {
                chart.model.set('chart-time', [parseInt(m[1]), parseInt(m[2])])
            } else {
                chart.model.set('chart-time', [parseInt(time), null])
            }
        }
//			chart.model.set("timeline", _.extend({}, chart.model.get('timeline'), { defaultYear: parseFloat(time) }));

		// Map stuff below

		var year = params.year;
		if (year !== undefined) {
			chart.map.set("defaultYear", parseInt(year));
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
		chart.data.ready(function() {
			var country = params.country;
			if (country) {
				var codesOrNames = _.map(country.split('+'), function(v) { return decodeURIComponent(v) }),
					entities = _.filter(chart.vardata.get('availableEntities'), function(entity) {
					return _.includes(codesOrNames, entity.code) || _.includes(codesOrNames, entity.name);
				});

				chart.model.set('selected-countries', entities);
			}
		});

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
		var tabName = chart.activeTabName;

		if (lastTabName == "map" && tabName != "map") {
			urlBinder.mapQueryStr = window.location.search;
			owid.setQueryStr(urlBinder.chartQueryStr);
		} else if (lastTabName == "map" && tabName != "map") {
			urlBinder.chartQueryStr = window.location.search;
			owid.setQueryStr(urlBinder.mapQueryStr);
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
	urlBinder.updateCountryParam = updateCountryParam;

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
		if (chart.activeTabName == 'map')
			owid.setQueryVariable("year", chart.map.get("targetYear"));
	}

	/**
	 * Set e.g. &time=1990 when the user uses the slider to go to 1990
	 */
	function updateTime() {
		if (chart.activeTabName == 'chart' && chart.model.get('timeline')) {
            const timeRange = chart.model.get('chart-time')
            if (_.isNumber(timeRange[0]) && _.isNumber(timeRange[1]) && timeRange[0] != timeRange[1]) {
                owid.setQueryVariable("time", timeRange[0] + ".." + timeRange[1])
            } else if (_.isNumber(timeRange[0])) {
                owid.setQueryVariable("time", timeRange[0])
            }
        }
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
		if (stackMode != origConfig.currentStackMode)
			owid.setQueryVariable("stackMode", stackMode);
		else
			owid.setQueryVariable("stackMode", null);
	}

	function updateAxisScales() {
		var xAxisScale = chart.model.getAxisConfig('x-axis', 'axis-scale');
		if (xAxisScale != originalXAxisScale)
			owid.setQueryVariable("xScale", xAxisScale);
		else
			owid.setQueryVariable("xScale", null);

		var yAxisScale = chart.model.getAxisConfig('y-axis', 'axis-scale');
		if (yAxisScale != originalYAxisScale)
			owid.setQueryVariable("yScale", yAxisScale);
		else
			owid.setQueryVariable("yScale", null);
	}

	initialize();
	return urlBinder;
};
