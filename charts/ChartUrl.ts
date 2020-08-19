/* ChartUrl.ts
 * ================
 *
 * This component is responsible for translating between the
 * the chart and url parameters, to enable nice linking support
 * for specific countries and years.
 */
import { computed, when, runInAction, observable, action } from "mobx"

import { BAKED_GRAPHER_URL, EPOCH_DATE } from "settings"

import { includes, defaultTo, formatDay, diffDateISOStringInDays } from "./Util"
import { ChartTabOption } from "./ChartTabOption"
import { ChartConfig } from "./ChartConfig"
import {
    queryParamsToStr,
    strToQueryParams,
    QueryParams
} from "utils/client/url"
import { MapProjection } from "./MapProjection"
import { ObservableUrl } from "./UrlBinder"
import {
    formatTimeBound,
    isUnbounded,
    TimeBoundValue,
    TimeBound,
    parseTimeBound
} from "./TimeBounds"
import { Analytics } from "site/client/Analytics"

export interface ChartQueryParams extends QueryParams {
    tab?: string
    overlay?: string
    stackMode?: string
    zoomToSelection?: string
    minPopulationFilter?: string
    xScale?: string
    yScale?: string
    time?: string
    year?: string
    region?: string
    country?: string
    shown?: string
    endpointsOnly?: string
}

// Todo: ensure entityCodeOrName never contain the v2Delimiter
declare type entityCodeOrName = string

export class EntityUrlBuilder {
    private static v1Delimiter = "+"
    private static v2Delimiter = "~"

    static entitiesToQueryParam(entities: entityCodeOrName[]) {
        // Always include a v2Delimiter in a v2 link. When decoding we will drop any empty strings.
        if (entities.length === 1)
            return encodeURIComponent(this.v2Delimiter + entities[0])

        return encodeURIComponent(entities.join(this.v2Delimiter))
    }

    static queryParamToEntities(queryParam: string) {
        // First preserve handling of the old v1 country=USA+FRA style links. If a link does not
        // include a v2Delimiter and includes a + we assume it's a v1 link. Unfortunately link sharing
        // with v1 links did not work on Facebook because FB would replace %20 with "+".
        return this.isV1Link(queryParam)
            ? this.decodeV1Link(queryParam)
            : this.decodeV2Link(queryParam)
    }

    private static isV1Link(queryParam: string) {
        // No entities currently have a v2Delimiter in their name so if a v2Delimiter is present we know it's a v2 link.
        return !decodeURIComponent(queryParam).includes(this.v2Delimiter)
    }

    private static decodeV1Link(queryParam: string) {
        return queryParam.split(this.v1Delimiter).map(decodeURIComponent)
    }

    private static decodeV2Link(queryParam: string) {
        // Facebook turns %20 into +. v2 links will never contain a +, so we can safely replace all of them with %20.
        return decodeURIComponent(queryParam.replace(/\+/g, "%20"))
            .split(this.v2Delimiter)
            .filter(item => item)
    }
}

const reISODateComponent = new RegExp("\\d{4}-[01]\\d-[0-3]\\d")
const reISODate = new RegExp(`^(${reISODateComponent.source})$`)

function formatTimeURIComponent(time: TimeBound, isDate: boolean): string {
    if (isUnbounded(time)) return formatTimeBound(time)
    return isDate ? formatDay(time, { format: "YYYY-MM-DD" }) : `${time}`
}

function parseTimeURIComponent(
    param: string,
    defaultValue: TimeBound
): TimeBound {
    if (reISODate.test(param)) {
        return diffDateISOStringInDays(param, EPOCH_DATE)
    }
    return parseTimeBound(param, defaultValue)
}

export class ChartUrl implements ObservableUrl {
    chart: ChartConfig
    chartQueryStr: string = "?"
    mapQueryStr: string = "?"
    debounceMode: boolean = false

    constructor(chart: ChartConfig, queryStr?: string) {
        this.chart = chart

        if (queryStr !== undefined) {
            this.populateFromQueryParams(strToQueryParams(queryStr))
        }
    }

    @computed get origChartProps() {
        return this.chart.origProps
    }

    // Autocomputed url params to reflect difference between current chart state
    // and original config state
    @computed.struct get params(): ChartQueryParams {
        const params: ChartQueryParams = {}
        const { chart, origChartProps } = this

        params.tab =
            chart.props.tab === origChartProps.tab ? undefined : chart.props.tab
        //params.overlay = chart.props.overlay === origChartProps.overlay ? undefined : chart.props.overlay
        params.xScale =
            chart.props.xAxis.scaleType === origChartProps.xAxis.scaleType
                ? undefined
                : chart.xAxis.scaleType
        params.yScale =
            chart.props.yAxis.scaleType === origChartProps.yAxis.scaleType
                ? undefined
                : chart.yAxis.scaleType
        params.stackMode =
            chart.props.stackMode === origChartProps.stackMode
                ? undefined
                : chart.props.stackMode
        params.zoomToSelection =
            chart.props.zoomToSelection === origChartProps.zoomToSelection
                ? undefined
                : chart.props.zoomToSelection
                ? "true"
                : undefined
        params.minPopulationFilter =
            chart.props.minPopulationFilter ===
            origChartProps.minPopulationFilter
                ? undefined
                : chart.props.minPopulationFilter?.toString()
        params.endpointsOnly =
            chart.props.compareEndPointsOnly ===
            origChartProps.compareEndPointsOnly
                ? undefined
                : chart.props.compareEndPointsOnly
                ? "1"
                : "0"
        params.year = this.yearParam
        params.time = this.timeParam
        params.country = this.countryParam

        if (
            chart.props.map &&
            origChartProps.map &&
            chart.props.map.projection !== origChartProps.map.projection
        )
            params.region = chart.props.map.projection

        return params
    }

    @computed get queryStr(): string {
        const externalParams = this.externallyProvidedParams || {}
        const queryParams = {
            ...this.params,
            ...externalParams
        }
        return queryParamsToStr(queryParams)
    }

    @computed get baseUrl(): string | undefined {
        if (this.externalBaseUrl) return this.externalBaseUrl
        if (this.chart.isPublished)
            return `${BAKED_GRAPHER_URL}/${this.chart.slug}`
        else return undefined
    }

    @observable externalBaseUrl: string = ""
    @observable.shallow externallyProvidedParams?: QueryParams

    // Get the full url representing the canonical location of this chart state
    @computed get canonicalUrl(): string | undefined {
        return this.baseUrl ? this.baseUrl + this.queryStr : undefined
    }

    @computed get yearParam(): string | undefined {
        const { chart, origChartProps } = this

        if (
            chart.map &&
            origChartProps.map &&
            chart.map.targetYear !== origChartProps.map.targetYear
        ) {
            return formatTimeURIComponent(
                chart.map.targetYear,
                !!chart.table.hasDayColumn
            )
        } else {
            return undefined
        }
    }

    @computed get timeParam(): string | undefined {
        const { chart, origChartProps } = this

        if (
            chart.props.minTime !== origChartProps.minTime ||
            chart.props.maxTime !== origChartProps.maxTime
        ) {
            const [minTime, maxTime] = chart.timeDomain
            if (minTime === maxTime)
                return formatTimeURIComponent(
                    minTime,
                    !!chart.table.hasDayColumn
                )

            const start = formatTimeURIComponent(
                minTime,
                !!chart.table.hasDayColumn
            )
            const end = formatTimeURIComponent(
                maxTime,
                !!chart.table.hasDayColumn
            )
            return `${start}..${end}`
        } else {
            return undefined
        }
    }

    @computed private get countryParam(): string | undefined {
        const { chart, origChartProps } = this
        if (
            chart.isReady &&
            JSON.stringify(chart.props.selectedData) !==
                JSON.stringify(origChartProps.selectedData)
        ) {
            return EntityUrlBuilder.entitiesToQueryParam(
                chart.data.selectedEntityCodes
            )
        } else {
            return undefined
        }
    }

    /**
     * Set e.g. &shown=Africa when the user selects Africa on a stacked area chartView or other
     * toggle-based legend chartView.
     */
    /*updateLegendKeys() {
        var activeLegendKeys = chartView.model.get("activeLegendKeys");
        if (activeLegendKeys === null)
            setQueryVariable("shown", null);
        else {
            var keys = map(activeLegendKeys, function(key) {
                return encodeURIComponent(key);
            });
            setQueryVariable("shown", keys.join("+"));
        }
    }*/

    setTimeFromTimeQueryParam(time: string) {
        const { chart } = this

        // In the past we supported unbounded time parameters like time=2015.. which would be
        // equivalent to time=2015..latest. We don't actively generate these kinds of URL any
        // more because URLs ending with dots are not interpreted correctly by many services
        // (Twitter, Facebook and others) - but we still want to recognize incoming requests
        // for these "legacy" URLs!
        const reIntComponent = new RegExp("\\-?\\d+")
        const reIntRange = new RegExp(
            `^(${reIntComponent.source}|earliest)?\\.\\.(${reIntComponent.source}|latest)?$`
        )
        const reDateRange = new RegExp(
            `^(${reISODateComponent.source}|earliest)?\\.\\.(${reISODateComponent.source}|latest)?$`
        )
        if (reIntRange.test(time) || reDateRange.test(time)) {
            const [start, end] = time.split("..")
            chart.timeDomain = [
                parseTimeURIComponent(start, TimeBoundValue.unboundedLeft),
                parseTimeURIComponent(end, TimeBoundValue.unboundedRight)
            ]
        } else {
            const t = parseTimeURIComponent(time, TimeBoundValue.unboundedRight)
            chart.timeDomain = [t, t]
        }
    }

    /**
     * Applies query parameters to the chart config
     */
    @action.bound populateFromQueryParams(params: ChartQueryParams) {
        const { chart } = this

        // Set tab if specified
        const tab = params.tab
        if (tab) {
            if (!includes(chart.availableTabs, tab))
                console.error("Unexpected tab: " + tab)
            else chart.props.tab = tab as ChartTabOption
        }

        const overlay = params.overlay
        if (overlay) {
            if (!includes(chart.availableTabs, overlay))
                console.error("Unexpected overlay: " + overlay)
            else chart.props.overlay = overlay as ChartTabOption
        }

        // Stack mode for bar and stacked area charts
        chart.props.stackMode = defaultTo(
            params.stackMode,
            chart.props.stackMode
        )

        chart.props.zoomToSelection = defaultTo(
            params.zoomToSelection === "true" ? true : undefined,
            chart.props.zoomToSelection
        )

        chart.props.minPopulationFilter = defaultTo(
            params.minPopulationFilter
                ? parseInt(params.minPopulationFilter)
                : undefined,
            chart.props.minPopulationFilter
        )

        // Axis scale mode
        const xScaleType = params.xScale
        if (xScaleType) {
            if (xScaleType === "linear" || xScaleType === "log")
                chart.xAxis.scaleType = xScaleType
            else console.error("Unexpected xScale: " + xScaleType)
        }

        const yScaleType = params.yScale
        if (yScaleType) {
            if (yScaleType === "linear" || yScaleType === "log")
                chart.yAxis.scaleType = yScaleType
            else console.error("Unexpected xScale: " + yScaleType)
        }

        const time = params.time
        if (time) this.setTimeFromTimeQueryParam(time)

        const endpointsOnly = params.endpointsOnly
        if (endpointsOnly !== undefined) {
            chart.props.compareEndPointsOnly =
                endpointsOnly === "1" ? true : undefined
        }

        // Map stuff below

        if (chart.props.map) {
            if (params.year) {
                const year = parseTimeURIComponent(
                    params.year,
                    TimeBoundValue.unboundedRight
                )
                chart.props.map.targetYear = year
            }

            const region = params.region
            if (region !== undefined) {
                chart.props.map.projection = region as MapProjection
            }
        }

        // Selected countries -- we can't actually look these up until we have the data
        const country = params.country
        if (
            chart.props.useV2 ||
            !country ||
            chart.addCountryMode === "disabled"
        )
            return
        when(
            () => chart.isReady,
            () => {
                runInAction(() => {
                    const entityCodes = EntityUrlBuilder.queryParamToEntities(
                        country
                    )
                    const matchedEntities = this.chart.data.setSelectedEntitiesByCode(
                        entityCodes
                    )
                    const notFoundEntities = Array.from(
                        matchedEntities.keys()
                    ).filter(key => !matchedEntities.get(key))

                    if (notFoundEntities.length)
                        Analytics.logEntitiesNotFoundError(notFoundEntities)
                })
            }
        )

        // Set shown legend keys for chartViews with toggleable series
        /*var shown = params.shown;
         if (isString(shown)) {
             var keys = map(shown.split("+"), function(key) {
                 return decodeURIComponent(key);
             });

             chart.activeLegendKeys = keys
         }*/
    }
}

interface ObjectWithParams {
    params: QueryParams
}

export class ExtendedChartUrl implements ObservableUrl {
    chartUrl: ChartUrl
    private _params: ObjectWithParams[]

    constructor(chartUrl: ChartUrl, params: ObjectWithParams[]) {
        this.chartUrl = chartUrl
        this._params = params
    }

    @computed get params(): QueryParams {
        let obj = Object.assign({}, this.chartUrl.params)
        this._params.forEach(p => {
            obj = Object.assign(obj, p.params)
        })
        return obj
    }

    @computed get debounceMode(): boolean {
        return this.chartUrl.debounceMode
    }
}
