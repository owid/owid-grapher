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
    GrapherTabOption,
    ScaleType,
    StackMode
} from "charts/core/GrapherConstants"

import {
    includes,
    defaultTo,
    formatDay,
    diffDateISOStringInDays
} from "charts/utils/Util"

// todo: we should probably factor out this circular dependency
import { Grapher } from "charts/core/Grapher"

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
        const { grapher } = this
        const props = grapher.script

        params.tab = props.tab
        params.xScale = grapher.xAxisOptions.scaleType
        params.yScale = grapher.yAxisOptions.scaleType
        params.stackMode = props.stackMode
        params.zoomToSelection = props.zoomToSelection ? "true" : undefined
        params.minPopulationFilter = props.minPopulationFilter?.toString()
        params.endpointsOnly = props.compareEndPointsOnly ? "1" : "0"
        params.year = this.yearParam
        params.time = this.timeParam
        params.country = this.countryParam
        params.region = grapher.map?.projection

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

        if (params.xScale === origGrapherProps.xAxis.scaleType)
            params.xScale = undefined

        if (params.yScale === origGrapherProps.yAxis.scaleType)
            params.yScale = undefined

        if (params.stackMode === origGrapherProps.stackMode)
            params.stackMode = undefined

        if (grapher.script.zoomToSelection === origGrapherProps.zoomToSelection)
            params.zoomToSelection = undefined

        if (
            grapher.script.minPopulationFilter ===
            origGrapherProps.minPopulationFilter
        )
            params.minPopulationFilter = undefined

        if (
            grapher.script.compareEndPointsOnly ===
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
            ...externalParams
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

    @computed get yearParam(): string | undefined {
        const { grapher, origGrapherProps } = this

        if (
            grapher.mapTransform &&
            origGrapherProps.map &&
            grapher.mapTransform.targetYearProp !==
                origGrapherProps.map.targetYear
        ) {
            return formatTimeURIComponent(
                grapher.mapTransform.targetYearProp,
                !!grapher.table.hasDayColumn
            )
        } else {
            return undefined
        }
    }

    @computed get timeParam(): string | undefined {
        const { grapher, origGrapherProps } = this

        if (
            grapher.script.minTime !== origGrapherProps.minTime ||
            grapher.script.maxTime !== origGrapherProps.maxTime
        ) {
            const [minTime, maxTime] = grapher.timeDomain
            if (minTime === maxTime)
                return formatTimeURIComponent(
                    minTime,
                    !!grapher.table.hasDayColumn
                )

            const start = formatTimeURIComponent(
                minTime,
                !!grapher.table.hasDayColumn
            )
            const end = formatTimeURIComponent(
                maxTime,
                !!grapher.table.hasDayColumn
            )
            return `${start}..${end}`
        } else {
            return undefined
        }
    }

    @computed private get countryParam(): string | undefined {
        const { grapher, origGrapherProps } = this
        if (
            grapher.isReady &&
            JSON.stringify(grapher.script.selectedData) !==
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
        const { grapher } = this

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
            grapher.timeDomain = [
                parseTimeURIComponent(start, TimeBoundValue.unboundedLeft),
                parseTimeURIComponent(end, TimeBoundValue.unboundedRight)
            ]
        } else {
            const t = parseTimeURIComponent(time, TimeBoundValue.unboundedRight)
            grapher.timeDomain = [t, t]
        }
    }

    /**
     * Applies query parameters to the grapher config
     */
    @action.bound populateFromQueryParams(params: GrapherQueryParams) {
        const { grapher } = this

        // Set tab if specified
        const tab = params.tab
        if (tab) {
            if (!includes(grapher.availableTabs, tab))
                console.error("Unexpected tab: " + tab)
            else grapher.script.tab = tab as GrapherTabOption
        }

        const overlay = params.overlay
        if (overlay) {
            if (!includes(grapher.availableTabs, overlay))
                console.error("Unexpected overlay: " + overlay)
            else grapher.script.overlay = overlay as GrapherTabOption
        }

        // Stack mode for bar and stacked area charts
        grapher.script.stackMode = defaultTo(
            params.stackMode as StackMode,
            grapher.script.stackMode
        )

        grapher.script.zoomToSelection = defaultTo(
            params.zoomToSelection === "true" ? true : undefined,
            grapher.script.zoomToSelection
        )

        grapher.script.minPopulationFilter = defaultTo(
            params.minPopulationFilter
                ? parseInt(params.minPopulationFilter)
                : undefined,
            grapher.script.minPopulationFilter
        )

        // Axis scale mode
        const xScaleType = params.xScale
        if (xScaleType) {
            if (xScaleType === ScaleType.linear || xScaleType === ScaleType.log)
                grapher.xAxisOptions.scaleType = xScaleType
            else console.error("Unexpected xScale: " + xScaleType)
        }

        const yScaleType = params.yScale
        if (yScaleType) {
            if (yScaleType === ScaleType.linear || yScaleType === ScaleType.log)
                grapher.yAxisOptions.scaleType = yScaleType
            else console.error("Unexpected xScale: " + yScaleType)
        }

        const time = params.time
        if (time) this.setTimeFromTimeQueryParam(time)

        const endpointsOnly = params.endpointsOnly
        if (endpointsOnly !== undefined) {
            grapher.script.compareEndPointsOnly =
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
        if (grapher.useV2 || !country || grapher.addCountryMode === "disabled")
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
                    ).filter(key => !matchedEntities.get(key))

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
        this.objectsWithParams.forEach(p => {
            obj = Object.assign(obj, p.toQueryParams)
        })
        return obj
    }

    @computed get debounceMode(): boolean {
        return this.grapherUrl.debounceMode
    }
}
