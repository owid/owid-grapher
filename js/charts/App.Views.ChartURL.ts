/* App.Views.ChartURL.ts
 * ================
 *
 * This component is responsible for handling data binding between the
 * the chartView and url parameters, to enable nice linking support
 * for specific countries and years.
 *
 */

import * as _ from 'lodash'
import * as $ from 'jquery'
import owid from '../owid'
import {autorun, action} from 'mobx'
import ChartView from './ChartView'
import ChartTabOption from './ChartTabOption'

export default function(chartView: ChartView) {
    const {chart} = chartView
    function urlBinder() { }

    // Keep the query params separate between map and the other tabs
    var lastTabName = null,
        originalTab = chart.tab,
        originalXAxisScale = chart.xAxis.scaleType,
        originalYAxisScale = chart.yAxis.scaleType;

    urlBinder.mapQueryStr = '?';
    urlBinder.chartQueryStr = '?';

    var origConfig = null;

    function initialize() {
        origConfig = _.clone(chartView.model.attributes);

        chartView.model.on("change:selected-countries", updateCountryParam);
        chartView.model.on("change:activeLegendKeys", updateLegendKeys);
        chartView.map.on("change:targetYear", updateYearParam);
        chartView.map.on("change:mode change:projection change:isColorblind", updateMapParams);
        chartView.model.on("change:currentStackMode", updateStackMode);
        chartView.model.on("change:chart-time", updateTime);
        action(populateFromURL)();

        $(window).on('query-change', function() {
            var tabName = chart.tab;
            if (tabName == 'chart' || tabName == 'map')
                urlBinder.lastQueryStr = window.location.search;
        });
        autorun(() => onTabChange())
        autorun(() => {
            owid.setQueryVariable("xScale", chart.xAxis.scaleType == originalXAxisScale ? null : chart.xAxis.scaleType);
            owid.setQueryVariable("yScale", chart.yAxis.scaleType == originalYAxisScale ? null : chart.yAxis.scaleType);            
        })
    };

    /**
     * Apply any url parameters on chartView startup
     */    
    function populateFromURL() {
        var params: {[key: string]: string} = owid.getQueryParams();

        // Set tab if specified
        var tab = params.tab;
        if (tab) {
            if (!_.includes(chart.availableTabs, tab) && tab !== 'download')
                console.error("Unexpected tab: " + tab);
            else {
                chart.tab = (tab as ChartTabOption)
            }
        }

        // Stack mode for bar and stacked area charts
        var stackMode = params.stackMode;
        if (stackMode !== undefined)
            chartView.model.set("currentStackMode", stackMode);

        // Axis scale mode
        const xScaleType = params.xScale
        if (xScaleType) {
            if (xScaleType == 'linear' || xScaleType == 'log')
                chart.xAxis.props.scaleType = xScaleType
            else
                console.error("Unexpected xScale: " + xScaleType)
        }

        const yScaleType = params.yScale
        if (yScaleType) {
            if (yScaleType == 'linear' || yScaleType == 'log')
                chart.yAxis.props.scaleType = yScaleType
            else
                console.error("Unexpected xScale: " + yScaleType)
        }
        
        var time = params.time;
        if (time !== undefined) {
            const m = time.match(/^(\d+)\.\.(\d+)$/)
            if (m) {
                chartView.model.set('chartView-time', [parseInt(m[1]), parseInt(m[2])])
            } else {
                chartView.model.set('chartView-time', [parseInt(time), parseInt(time)])
            }
        }
//          chartView.model.set("timeline", _.extend({}, chartView.model.get('timeline'), { defaultYear: parseFloat(time) }));

        // Map stuff below

        var year = params.year;
        if (year !== undefined) {
            chartView.map.set("defaultYear", parseInt(year));
        }

        var region = params.region;
        if (region !== undefined) {
            chartView.map.set("defaultProjection", region);
        }

        var colorblind = params.colorblind;
        if (colorblind == 1) {
            chartView.map.set("isColorblind", true);
        }

        var interpolate = params.interpolate;
        if (interpolate == 0) {
            chartView.map.set("mode", "no-interpolation");
        }

        // Selected countries -- we can't actually look these up until we have the data
        chartView.data.ready(action(function() {
            var country = params.country;
            if (country) {
                var codesOrNames = _.map(country.split('+'), function(v) { return decodeURIComponent(v) }),
                    entities = _.filter(chartView.vardata.get('availableEntities'), function(entity) {
                    return _.includes(codesOrNames, entity.code) || _.includes(codesOrNames, entity.name);
                });

                chart.selectedEntities = _.map(entities, 'name')
            }
        }));

        // Set shown legend keys for chartViews with toggleable series
        var shown = params.shown;
        if (_.isString(shown)) {
            var keys = _.map(shown.split("+"), function(key) {
                return decodeURIComponent(key);
            });

            chartView.model.set("activeLegendKeys", keys);
        }
    }

    /**
     * Save the current tab the user is on, and keep url params correctly isolated
     */
    function onTabChange() {
        var tabName = chart.tab;

        if (lastTabName == "map" && tabName != "map") {
            urlBinder.mapQueryStr = window.location.search;
            owid.setQueryStr(urlBinder.chartQueryStr);
        } else if (lastTabName == "map" && tabName != "map") {
            urlBinder.chartQueryStr = window.location.search;
            owid.setQueryStr(urlBinder.mapQueryStr);
        }

        if (tabName == originalTab)
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
        var selectedEntities = chartView.model.get("selected-countries"),
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
     * Set e.g. &shown=Africa when the user selects Africa on a stacked area chartView or other
     * toggle-based legend chartView.
     */
    function updateLegendKeys() {
        var activeLegendKeys = chartView.model.get("activeLegendKeys");
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
        if (chart.tab == 'map')
            owid.setQueryVariable("year", chartView.map.get("targetYear"));
    }

    /**
     * Set e.g. &time=1990 when the user uses the slider to go to 1990
     */
    function updateTime() {
        if (chart.tab == 'chart' && chartView.model.get('timeline')) {
            const timeRange = chartView.model.get('chart-time')
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
        var mapConfig = chartView.map.attributes;

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
     * Special config for stacked area chartViews
     */
    function updateStackMode() {
        var stackMode = chartView.model.get("currentStackMode");
        if (stackMode != origConfig.currentStackMode)
            owid.setQueryVariable("stackMode", stackMode);
        else
            owid.setQueryVariable("stackMode", null);
    }

    urlBinder.getCurrentLink = function() {
        var baseUrl = Global.rootUrl + "/" + chartView.model.get("slug"),
            queryParams = owid.getQueryParams(),
            queryStr = owid.queryParamsToStr(queryParams),
            canonicalUrl = baseUrl + queryStr;

        return canonicalUrl
    }

    initialize();
    return urlBinder;
};
