/* ChartUrl.ts
 * ================
 *
 * This component is responsible for translating between the
 * the chart and url parameters, to enable nice linking support
 * for specific countries and years.
 */
import { computed, observable } from "mobx"

// todo: we should probably factor out this circular dependency
import { Grapher } from "grapher/core/Grapher"

import { queryParamsToStr, QueryParams } from "utils/client/url"
import { ObservableUrl } from "grapher/utils/UrlBinder"
import { formatTimeURIComponent } from "grapher/utils/TimeBounds"
import { EntityUrlBuilder } from "./EntityUrlBuilder"
import { GrapherInterface } from "./GrapherInterface"
import { omit } from "grapher/utils/Util"

export interface GrapherQueryParams {
    tab?: string
    overlay?: string
    stackMode?: string
    zoomToSelection?: string
    minPopulationFilter?: string
    xScale?: string
    yScale?: string
    time?: string
    region?: string
    country?: string
    shown?: string
    endpointsOnly?: string
}

export interface LegacyGrapherQueryParams extends GrapherQueryParams {
    year?: string
}

export const legacyQueryParamsToCurrentQueryParams = (
    params: LegacyGrapherQueryParams
) => {
    const obj = omit(params, "year") as GrapherQueryParams

    if (params.year !== undefined) obj.time = obj.time ?? params.year

    return obj
}

// Todo: this should probably be merged into PeristableGrapher
export class GrapherUrl implements ObservableUrl {
    private grapher: Grapher
    debounceMode: boolean = false
    private originalConfig: GrapherInterface
    private urlRoot: string

    constructor(
        grapher: Grapher,
        originalConfig?: GrapherInterface,
        urlRoot = "/grapher"
    ) {
        this.grapher = grapher
        this.originalConfig = originalConfig || {}
        this.urlRoot = urlRoot
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
        return (this.dropUnchangedParams
            ? this.changedParams
            : this.allParams) as QueryParams
    }

    // Autocomputed url params to reflect difference between current grapher state
    // and original config state
    @computed.struct private get changedParams() {
        const params = this.allParams
        const { grapher, originalConfig } = this

        if (params.tab === originalConfig.tab) params.tab = undefined

        if (params.xScale === originalConfig.xAxis?.scaleType)
            params.xScale = undefined

        if (params.yScale === originalConfig.yAxis?.scaleType)
            params.yScale = undefined

        if (params.stackMode === originalConfig.stackMode)
            params.stackMode = undefined

        if (grapher.zoomToSelection === originalConfig.zoomToSelection)
            params.zoomToSelection = undefined

        if (grapher.minPopulationFilter === originalConfig.minPopulationFilter)
            params.minPopulationFilter = undefined

        if (
            grapher.compareEndPointsOnly === originalConfig.compareEndPointsOnly
        )
            params.endpointsOnly = undefined

        if (
            originalConfig.map &&
            params.region === originalConfig.map.projection
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

    @computed get timeParam(): string | undefined {
        const { grapher, originalConfig } = this
        const formatAsDay = grapher.table.hasDayColumn

        if (
            grapher.minTime !== originalConfig.minTime ||
            grapher.maxTime !== originalConfig.maxTime
        ) {
            const [minTime, maxTime] = grapher.timeDomain

            const start = formatTimeURIComponent(minTime, formatAsDay)

            if (minTime === maxTime) return start

            const end = formatTimeURIComponent(maxTime, formatAsDay)
            return `${start}..${end}`
        }

        if (grapher.map.time !== undefined)
            return formatTimeURIComponent(grapher.map.time, formatAsDay)

        return undefined
    }

    @computed private get countryParam(): string | undefined {
        const { grapher, originalConfig } = this
        if (
            grapher.isReady &&
            JSON.stringify(grapher.selectedData) !==
                JSON.stringify(originalConfig.selectedData)
        ) {
            return EntityUrlBuilder.entitiesToQueryParam(
                grapher.selectedEntityCodes
            )
        } else {
            return undefined
        }
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

    @computed get params() {
        let obj = Object.assign({}, this.grapherUrl.params) as QueryParams
        this.objectsWithParams.forEach((p) => {
            obj = Object.assign(obj, p.toQueryParams)
        })
        return obj
    }

    @computed get debounceMode(): boolean {
        return this.grapherUrl.debounceMode
    }
}
