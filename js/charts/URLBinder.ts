/* URLBinder.ts
 * ================
 *
 * This component is responsible for handling data binding between the
 * the chartView and url parameters, to enable nice linking support
 * for specific countries and years.
 *
 */

import * as _ from 'lodash'
import * as $ from 'jquery'
import {computed, observable, autorun, action, reaction, toJS} from 'mobx'
import ChartView from './ChartView'
import ChartTabOption from './ChartTabOption'
import ScaleType from './ScaleType'
import {defaultTo} from './Util'
import ChartConfig, {ChartConfigProps} from './ChartConfig'
import EntityKey from './EntityKey'
import {getQueryParams, setQueryVariable, setQueryStr, queryParamsToStr, QueryParams} from './Util'

interface ChartQueryParams {
    tab?: string,
    stackMode?: string,
    xScale?: string,
    yScale?: string,
    time?: string,
    year?: string,
    region?: string,
    country?: string,
    shown?: string
}

export default class URLBinder {
    chart: ChartConfig

    lastTabName: ChartTabOption
    origChart: ChartConfigProps
    chartQueryStr: string = "?"
    mapQueryStr: string = "?"

    constructor(chart: ChartConfig) {
        this.chart = chart
        return
        this.lastTabName = chart.tab
        this.origChart = toJS(chart.props)
        this.populateFromURL()

        // There is a surprisingly considerable performance overhead to updating the url
        // while animating, so we debounce to allow e.g. smoother timelines
        const pushParams = _.debounce(function(params: ChartQueryParams) {
            setQueryStr(queryParamsToStr(params as QueryParams))
        }, 50)
        autorun(() => {
            const {params} = this
            pushParams(params)
        })
    }

    @computed get timeParam(): string|undefined {
        const {timeDomain} = this.chart.props
        if (!_.isEqual(timeDomain, this.origChart.timeDomain)) {
            if (_.isFinite(timeDomain[0]) && _.isFinite(timeDomain[1]) && timeDomain[0] != timeDomain[1]) {
                return timeDomain[0] + ".." + timeDomain[1]
            } else if (_.isNumber(timeDomain[0])) {
                return _.toString(timeDomain[0])
            }
        } else {
            return undefined
        }
    }

    @computed get countryParam(): string|undefined {
        const {chart, origChart} = this
        if (this.chart.vardata.isReady && !_.isEqual(chart.props.selectedEntities, origChart.selectedEntities)) {
            function getCode(entity: EntityKey) { 
                const meta = this.chart.vardata.entityMetaByKey[entity]
                return meta ? meta.code : entity
            }
            const codes = chart.selectedEntities.map(getCode).map(encodeURIComponent)
            setQueryVariable("country", codes.join("+"))
        } else {
            return undefined
        }
    }

    @computed.struct get params(): ChartQueryParams {
        const params: ChartQueryParams = {}
        const {chart, origChart} = this

        params.tab = chart.props.tab == origChart.tab ? undefined : chart.tab
        params.xScale = chart.props.xAxis.scaleType == origChart.xAxis.scaleType ? undefined : chart.xAxis.scaleType
        params.yScale = chart.props.yAxis.scaleType == origChart.yAxis.scaleType? undefined : chart.yAxis.scaleType
        params.time = this.timeParam
        params.country = this.countryParam

        return params
    }    

    /**
     * Set e.g. &shown=Africa when the user selects Africa on a stacked area chartView or other
     * toggle-based legend chartView.
     */
    updateLegendKeys() {
        /*var activeLegendKeys = chartView.model.get("activeLegendKeys");
        if (activeLegendKeys === null)
            setQueryVariable("shown", null);
        else {
            var keys = _.map(activeLegendKeys, function(key) {
                return encodeURIComponent(key);
            });
            setQueryVariable("shown", keys.join("+"));
        }*/
     }

    /**
     * Set e.g. &year=1990 when the user uses the map slider to go to 1990
     */
    updateYearParam() {
        //if (chart.tab == 'map')
        //    setQueryVariable("year", chartView.map.get("targetYear"));
    }


    getCurrentLink() {
        var baseUrl = Global.rootUrl + "/" + this.chart.slug,
            queryParams = getQueryParams(),
            queryStr = queryParamsToStr(queryParams),
            canonicalUrl = baseUrl + queryStr;

        return canonicalUrl
    }

    /**
     * Apply any url parameters on chartView startup
     */    
    populateFromURL() {
        const {params, chart} = this

        // Set tab if specified
        const tab = params.tab;
        if (tab) {
            if (!_.includes(chart.availableTabs, tab) && tab !== 'download')
                console.error("Unexpected tab: " + tab);
            else
                chart.tab = (tab as ChartTabOption)
        }

        // Stack mode for bar and stacked area charts
        //chart.currentStackMode = defaultTo(params.stackMode, chart.currentStackMode)

        // Axis scale mode
        const xScaleType = params.xScale
        if (xScaleType) {
            if (xScaleType == 'linear' || xScaleType == 'log')
                chart.xAxis.scaleType = xScaleType
            else
                console.error("Unexpected xScale: " + xScaleType)
        }

        const yScaleType = params.yScale
        if (yScaleType) {
            if (yScaleType == 'linear' || yScaleType == 'log')
                chart.yAxis.scaleType = yScaleType
            else
                console.error("Unexpected xScale: " + yScaleType)
        }
        
        var time = params.time;
        if (time !== undefined) {
            const m = time.match(/^(\d+)\.\.(\d+)$/)
            if (m) {
                chart.timeDomain = [parseInt(m[1]), parseInt(m[2])]
            } else {
                chart.timeDomain = [parseInt(time), parseInt(time)]
            }
        }

        // Map stuff below

        /*var year = params.year;
        if (year !== undefined) {
            chartView.map.set("defaultYear", parseInt(year));
        }

        var region = params.region;
        if (region !== undefined) {
            chartView.map.set("defaultProjection", region);
        }*/

        // Selected countries -- we can't actually look these up until we have the data
        var country = params.country;
        autorun(() => {
            if (!chart.data.availableEntities) return

            if (country) {
                const entityCodes = _.map(country.split('+'), decodeURIComponent)
                chart.selectedEntities = _.filter(chart.data.availableEntities, entity => {
                    const meta = chart.vardata.entityMetaByKey[entity]
                    return _.includes(entityCodes, meta.code) || _.includes(entityCodes, meta.name)
                })
            }
        })

        // Set shown legend keys for chartViews with toggleable series
        var shown = params.shown;
        if (_.isString(shown)) {
            var keys = _.map(shown.split("+"), function(key) {
                return decodeURIComponent(key);
            });

            chart.activeLegendKeys = keys
        }
    }
}

export function foof(chartView: ChartView) {
    const {chart} = chartView
    function urlBinder() { }

    // Keep the query params separate between map and the other tabs

    urlBinder.mapQueryStr = '?';
    urlBinder.chartQueryStr = '?';

    var origConfig = null;

    function initialize() {
        origConfig = _.clone(chartView.model.attributes);

        chartView.model.on("change:selected-countries", updateCountryParam);
        chartView.model.on("change:activeLegendKeys", updateLegendKeys);
        //chartView.map.on("change:targetYear", updateYearParam);
        //chartView.map.on("change:mode change:projection change:isColorblind", updateMapParams);
        chartView.model.on("change:currentStackMode", updateStackMode);
        chartView.model.on("change:chart-time", updateTime);
        autorun(populateFromURL)

        $(window).on('query-change', function() {
            var tabName = chart.tab;
            if (tabName == 'chart' || tabName == 'map')
                urlBinder.lastQueryStr = window.location.search;
        });
        autorun(() => onTabChange())

    };




    function updateCountryParam() {

    }
    urlBinder.updateCountryParam = updateCountryParam;


    /**
     * Set e.g. &time=1990 when the user uses the slider to go to 1990
     */
    function updateTime() {

    }

    /**
     * Special config for stacked area chartViews
     */
    function updateStackMode() {
        var stackMode = chartView.model.get("currentStackMode");
        if (stackMode != origConfig.currentStackMode)
            setQueryVariable("stackMode", stackMode);
        else
            setQueryVariable("stackMode", null);
    }

    initialize();
    return urlBinder;
};
