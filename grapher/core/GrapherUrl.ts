/* ChartUrl.ts
 * ================
 *
 * This component is responsible for translating between the
 * the chart and url parameters, to enable nice linking support
 * for specific countries and years.
 */
import { computed, when, runInAction, observable, action } from "mobx"

import {
    GrapherTabOption,
    ScaleType,
    StackMode,
} from "grapher/core/GrapherConstants"

import { defaultTo } from "grapher/utils/Util"

// todo: we should probably factor out this circular dependency
import { Grapher } from "grapher/core/Grapher"

import {
    queryParamsToStr,
    strToQueryParams,
    QueryParams,
} from "utils/client/url"
import { MapProjection } from "grapher/mapCharts/MapProjections"
import { ObservableUrl } from "grapher/utils/UrlBinder"
import {
    TimeBoundValue,
    formatTimeURIComponent,
    getTimeDomainFromQueryString,
    parseTimeURIComponent,
} from "grapher/utils/TimeBounds"
import { EntityUrlBuilder } from "./EntityUrlBuilder"

export interface GrapherQueryParams extends QueryParams {
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

// Todo: this should probably be merged into PeristableGrapher
export class GrapherUrl implements ObservableUrl {
    private grapher: Grapher
    grapherQueryStr: string = "?"
    mapQueryStr: string = "?"
    debounceMode: boolean = false

    constructor(grapher: Grapher, queryStr?: string) {
        this.grapher = grapher

        if (queryStr !== undefined) {
            this.populateFromQueryParams(strToQueryParams(queryStr))
        }
    }

    @computed private get origGrapherProps() {
        return this.grapher.origScript
    }

    @computed.struct private get allParams() {
        const params: GrapherQueryParams = {}
        const grapher = this.grapher

        params.tab = grapher.tab
        params.xScale = grapher.xAxis.scaleType
        params.yScale = grapher.yAxis.scaleType
        params.stackMode = grapher.stackMode
        params.zoomToSelection = grapher.zoomToSelection ? "true" : undefined
        params.minPopulationFilter = grapher.minPopulationFilter?.toString()
        params.endpointsOnly = grapher.compareEndPointsOnly ? "1" : "0"
        params.year = this.yearParam
        params.time = this.timeParam
        params.country = this.countryParam
        params.region = grapher.map.projection

        return params
    }

    // If the user changes a param so that it matches the author's original param, we drop it.
    // However, in the case of explorers, the user might switch graphers, and so we never want to drop
    // params. This flag turns off dropping of params.
    @observable dropUnchangedParams = true

    @computed get params() {
        return this.dropUnchangedParams ? this.changedParams : this.allParams
    }

    // Autocomputed url params to reflect difference between current grapher state
    // and original config state
    @computed.struct private get changedParams() {
        const params = this.allParams
        const { grapher, origGrapherProps } = this

        if (params.tab === origGrapherProps.tab) params.tab = undefined

        if (params.xScale === origGrapherProps.xAxis?.scaleType)
            params.xScale = undefined

        if (params.yScale === origGrapherProps.yAxis?.scaleType)
            params.yScale = undefined

        if (params.stackMode === origGrapherProps.stackMode)
            params.stackMode = undefined

        if (grapher.zoomToSelection === origGrapherProps.zoomToSelection)
            params.zoomToSelection = undefined

        if (
            grapher.minPopulationFilter === origGrapherProps.minPopulationFilter
        )
            params.minPopulationFilter = undefined

        if (
            grapher.compareEndPointsOnly ===
            origGrapherProps.compareEndPointsOnly
        )
            params.endpointsOnly = undefined

        if (
            origGrapherProps.map &&
            params.region === origGrapherProps.map.projection
        )
            params.region = undefined

        return params
    }

    @computed get queryStr(): string {
        const externalParams = this.externallyProvidedParams || {}
        const queryParams = {
            ...this.params,
            ...externalParams,
        }
        return queryParamsToStr(queryParams)
    }

    @observable urlRoot = "/grapher"

    @computed get baseUrl(): string | undefined {
        if (this.externalBaseUrl) return this.externalBaseUrl
        if (this.grapher.isPublished)
            return `${this.urlRoot}/${this.grapher.displaySlug}`
        return undefined
    }

    @observable externalBaseUrl: string = ""
    @observable.shallow externallyProvidedParams?: QueryParams

    // Get the full url representing the canonical location of this grapher state
    @computed get canonicalUrl(): string | undefined {
        return this.baseUrl ? this.baseUrl + this.queryStr : undefined
    }

    // Todo: why do we have a year and time param? Should this be mapYear?
    @computed private get yearParam(): string | undefined {
        const { grapher, origGrapherProps } = this

        if (
            grapher.mapTransform &&
            origGrapherProps.map &&
            grapher.mapTransform.targetYearProp !==
                origGrapherProps.map.targetYear
        )
            return formatTimeURIComponent(
                grapher.mapTransform.targetYearProp,
                !!grapher.table.hasDayColumn
            )

        return undefined
    }

    @computed get timeParam(): string | undefined {
        const { grapher, origGrapherProps } = this

        if (
            grapher.minTime !== origGrapherProps.minTime ||
            grapher.maxTime !== origGrapherProps.maxTime
        ) {
            const [minTime, maxTime] = grapher.timeDomain
            const formatAsDay = !!grapher.table.hasDayColumn

            if (minTime === maxTime)
                return formatTimeURIComponent(minTime, formatAsDay)

            const start = formatTimeURIComponent(minTime, formatAsDay)
            const end = formatTimeURIComponent(maxTime, formatAsDay)
            return `${start}..${end}`
        }
        return undefined
    }

    @computed private get countryParam(): string | undefined {
        const { grapher, origGrapherProps } = this
        if (
            grapher.isReady &&
            JSON.stringify(grapher.selectedData) !==
                JSON.stringify(origGrapherProps.selectedData)
        ) {
            return EntityUrlBuilder.entitiesToQueryParam(
                grapher.selectedEntityCodes
            )
        } else {
            return undefined
        }
    }

    setTimeFromTimeQueryParam(time: string) {
        this.grapher.timeDomain = getTimeDomainFromQueryString(time)
    }

    /**
     * Applies query parameters to the grapher config
     */
    @action.bound populateFromQueryParams(params: GrapherQueryParams) {
        const { grapher } = this

        // Set tab if specified
        const tab = params.tab
        if (tab) {
            if (!grapher.availableTabs.includes(tab as GrapherTabOption))
                console.error("Unexpected tab: " + tab)
            else grapher.tab = tab as GrapherTabOption
        }

        const overlay = params.overlay
        if (overlay) {
            if (!grapher.availableTabs.includes(overlay as GrapherTabOption))
                console.error("Unexpected overlay: " + overlay)
            else grapher.overlay = overlay as GrapherTabOption
        }

        // Stack mode for bar and stacked area charts
        grapher.stackMode = defaultTo(
            params.stackMode as StackMode,
            grapher.stackMode
        )

        grapher.zoomToSelection = defaultTo(
            params.zoomToSelection === "true" ? true : undefined,
            grapher.zoomToSelection
        )

        grapher.minPopulationFilter = defaultTo(
            params.minPopulationFilter
                ? parseInt(params.minPopulationFilter)
                : undefined,
            grapher.minPopulationFilter
        )

        // Axis scale mode
        const xScaleType = params.xScale
        if (xScaleType) {
            if (xScaleType === ScaleType.linear || xScaleType === ScaleType.log)
                grapher.xAxis.scaleType = xScaleType
            else console.error("Unexpected xScale: " + xScaleType)
        }

        const yScaleType = params.yScale
        if (yScaleType) {
            if (yScaleType === ScaleType.linear || yScaleType === ScaleType.log)
                grapher.yAxis.scaleType = yScaleType
            else console.error("Unexpected xScale: " + yScaleType)
        }

        const time = params.time
        if (time) this.setTimeFromTimeQueryParam(time)

        const endpointsOnly = params.endpointsOnly
        if (endpointsOnly !== undefined) {
            grapher.compareEndPointsOnly =
                endpointsOnly === "1" ? true : undefined
        }

        // Map stuff below

        if (grapher.map) {
            if (params.year) {
                const year = parseTimeURIComponent(
                    params.year,
                    TimeBoundValue.unboundedRight
                )
                grapher.map.targetYear = year
            }

            const region = params.region
            if (region !== undefined) {
                grapher.map.projection = region as MapProjection
            }
        }

        // Selected countries -- we can't actually look these up until we have the data
        const country = params.country
        if (
            grapher.manuallyProvideData ||
            !country ||
            grapher.addCountryMode === "disabled"
        )
            return
        when(
            () => grapher.isReady,
            () => {
                runInAction(() => {
                    const entityCodes = EntityUrlBuilder.queryParamToEntities(
                        country
                    )
                    const matchedEntities = this.grapher.setSelectedEntitiesByCode(
                        entityCodes
                    )
                    const notFoundEntities = Array.from(
                        matchedEntities.keys()
                    ).filter((key) => !matchedEntities.get(key))

                    if (notFoundEntities.length)
                        grapher.analytics.logEntitiesNotFoundError(
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

export class ExtendedGrapherUrl implements ObservableUrl {
    grapherUrl: GrapherUrl
    private objectsWithParams: ObjectWithToQueryParamsMethod[]

    constructor(
        grapherUrl: GrapherUrl,
        objectsWithParams: ObjectWithToQueryParamsMethod[]
    ) {
        this.grapherUrl = grapherUrl
        this.objectsWithParams = objectsWithParams
    }

    @computed get params(): QueryParams {
        let obj = Object.assign({}, this.grapherUrl.params)
        this.objectsWithParams.forEach((p) => {
            obj = Object.assign(obj, p.toQueryParams)
        })
        return obj
    }

    @computed get debounceMode(): boolean {
        return this.grapherUrl.debounceMode
    }
}
