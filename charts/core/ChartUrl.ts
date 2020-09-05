/* ChartUrl.ts
 * ================
 *
 * This component is responsible for translating between the
 * the chart and url parameters, to enable nice linking support
 * for specific countries and years.
 */
import { computed, when, runInAction, observable, action } from "mobx"

import {
    EPOCH_DATE,
    ChartTabOption,
    ScaleType,
    StackMode
} from "charts/core/ChartConstants"

import {
    includes,
    defaultTo,
    formatDay,
    diffDateISOStringInDays
} from "charts/utils/Util"

// todo: we should probably factor out this circular dependency
import { ChartConfig } from "./ChartConfig"

import {
    queryParamsToStr,
    strToQueryParams,
    QueryParams
} from "utils/client/url"
import { MapProjection } from "charts/mapCharts/MapProjections"
import { ObservableUrl } from "charts/utils/UrlBinder"
import {
    formatTimeBound,
    isUnbounded,
    TimeBoundValue,
    TimeBound,
    parseTimeBound
} from "charts/utils/TimeBounds"

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
    private chart: ChartConfig
    chartQueryStr: string = "?"
    mapQueryStr: string = "?"
    debounceMode: boolean = false

    constructor(chart: ChartConfig, queryStr?: string) {
        this.chart = chart

        if (queryStr !== undefined) {
            this.populateFromQueryParams(strToQueryParams(queryStr))
        }
    }

    @computed private get origChartProps() {
        return this.chart.origScript
    }

    @computed.struct private get allParams() {
        const params: ChartQueryParams = {}
        const { chart } = this
        const props = chart.props

        params.tab = props.tab
        params.xScale = chart.xAxisOptions.scaleType
        params.yScale = chart.yAxisOptions.scaleType
        params.stackMode = props.stackMode
        params.zoomToSelection = props.zoomToSelection ? "true" : undefined
        params.minPopulationFilter = props.minPopulationFilter?.toString()
        params.endpointsOnly = props.compareEndPointsOnly ? "1" : "0"
        params.year = this.yearParam
        params.time = this.timeParam
        params.country = this.countryParam
        params.region = chart.map?.projection

        return params
    }

    // If the user changes a param so that it matches the author's original param, we drop it.
    // However, in the case of explorers, the user might switch charts, and so we never want to drop
    // params. This flag turns off dropping of params.
    @observable dropUnchangedParams = true

    @computed get params() {
        return this.dropUnchangedParams ? this.changedParams : this.allParams
    }

    // Autocomputed url params to reflect difference between current chart state
    // and original config state
    @computed.struct private get changedParams() {
        const params = this.allParams
        const { chart, origChartProps } = this

        if (params.tab === origChartProps.tab) params.tab = undefined

        if (params.xScale === origChartProps.xAxis.scaleType)
            params.xScale = undefined

        if (params.yScale === origChartProps.yAxis.scaleType)
            params.yScale = undefined

        if (params.stackMode === origChartProps.stackMode)
            params.stackMode = undefined

        if (chart.props.zoomToSelection === origChartProps.zoomToSelection)
            params.zoomToSelection = undefined

        if (
            chart.props.minPopulationFilter ===
            origChartProps.minPopulationFilter
        )
            params.minPopulationFilter = undefined

        if (
            chart.props.compareEndPointsOnly ===
            origChartProps.compareEndPointsOnly
        )
            params.endpointsOnly = undefined

        if (
            origChartProps.map &&
            params.region === origChartProps.map.projection
        )
            params.region = undefined

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

    @observable urlRoot = "/grapher"

    @computed get baseUrl(): string | undefined {
        if (this.externalBaseUrl) return this.externalBaseUrl
        if (this.chart.isPublished) return `${this.urlRoot}/${this.chart.slug}`
        return undefined
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
            chart.mapTransform &&
            origChartProps.map &&
            chart.mapTransform.targetYearProp !== origChartProps.map.targetYear
        ) {
            return formatTimeURIComponent(
                chart.mapTransform.targetYearProp,
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
                chart.selectedEntityCodes
            )
        } else {
            return undefined
        }
    }

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
            params.stackMode as StackMode,
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
            if (xScaleType === ScaleType.linear || xScaleType === ScaleType.log)
                chart.xAxisOptions.scaleType = xScaleType
            else console.error("Unexpected xScale: " + xScaleType)
        }

        const yScaleType = params.yScale
        if (yScaleType) {
            if (yScaleType === ScaleType.linear || yScaleType === ScaleType.log)
                chart.yAxisOptions.scaleType = yScaleType
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

        if (chart.map) {
            if (params.year) {
                const year = parseTimeURIComponent(
                    params.year,
                    TimeBoundValue.unboundedRight
                )
                chart.map.targetYear = year
            }

            const region = params.region
            if (region !== undefined) {
                chart.map.projection = region as MapProjection
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
                    const matchedEntities = this.chart.setSelectedEntitiesByCode(
                        entityCodes
                    )
                    const notFoundEntities = Array.from(
                        matchedEntities.keys()
                    ).filter(key => !matchedEntities.get(key))

                    if (notFoundEntities.length)
                        chart.analytics.logEntitiesNotFoundError(
                            notFoundEntities
                        )
                })
            }
        )
    }
}

interface ObjectWithToQueryParamsMethod {
    toQueryParams: QueryParams
}

export class ExtendedChartUrl implements ObservableUrl {
    chartUrl: ChartUrl
    private objectsWithParams: ObjectWithToQueryParamsMethod[]

    constructor(
        chartUrl: ChartUrl,
        objectsWithParams: ObjectWithToQueryParamsMethod[]
    ) {
        this.chartUrl = chartUrl
        this.objectsWithParams = objectsWithParams
    }

    @computed get params(): QueryParams {
        let obj = Object.assign({}, this.chartUrl.params)
        this.objectsWithParams.forEach(p => {
            obj = Object.assign(obj, p.toQueryParams)
        })
        return obj
    }

    @computed get debounceMode(): boolean {
        return this.chartUrl.debounceMode
    }
}
