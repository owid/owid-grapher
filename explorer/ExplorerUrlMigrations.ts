import {
    QueryParams,
    queryParamsToStr,
    strToQueryParams,
} from "../clientUtils/url"
import { Url } from "../urls/Url"
import { omit, omitUndefinedValues } from "../clientUtils/Util"
import { Patch } from "../patch/Patch"
import { EXPLORERS_ROUTE_FOLDER } from "./ExplorerConstants"
import { legacyToCurrentGrapherUrl } from "../grapher/core/GrapherUrlMigrations"
import { EntityUrlBuilder } from "../grapher/core/EntityUrlBuilder"
import { UrlMigration } from "../urls/UrlMigration"

const patchFromQueryParams = (queryParams: QueryParams): Patch => {
    return new Patch(
        omitUndefinedValues({
            ...queryParams,
            // If we don't encode it as an array,
            // Patch will escape the column delimiter.
            selection: queryParams.selection
                ? EntityUrlBuilder.queryParamToEntityNames(
                      queryParams.selection
                  )
                : undefined,
        })
    )
}

const legacyIntervalToNewValue = {
    daily: "New per day",
    weekly: "Weekly",
    total: "Cumulative",
    smoothed: "7-day rolling average",
    biweekly: "Biweekly",
    weeklyChange: "Weekly change",
    biweeklyChange: "Biweekly change",
}

const covidMetricFromLegacyQueryParams = (queryParams: QueryParams) => {
    if (queryParams.casesMetric) {
        return "Confirmed cases"
    } else if (queryParams.deathsMetric) {
        return "Confirmed deaths"
    } else if (queryParams.cfrMetric) {
        return "Case fatality rate"
    } else if (queryParams.testsMetric) {
        return "Tests"
    } else if (queryParams.testsPerCaseMetric) {
        return "Tests per confirmed case"
    } else if (queryParams.positiveTestRate) {
        return "Share of positive tests"
    } else if (queryParams.vaccinationsMetric) {
        return "Vaccinations"
    }
    return undefined
}

const covidIntervalFromLegacyQueryParams = (queryParams: QueryParams) => {
    let legacyInterval: string | undefined = undefined

    // Early on, the query string was a few booleans like dailyFreq=true.
    // Now it is a single 'interval'. This transformation is for backward compat.
    if (queryParams.interval) {
        legacyInterval = queryParams.interval
    } else if (queryParams.totalFreq) {
        legacyInterval = "total"
    } else if (queryParams.dailyFreq) {
        legacyInterval = "daily"
    } else if (queryParams.smoothing) {
        legacyInterval = "smoothed"
    }

    if (legacyInterval) {
        return legacyIntervalToNewValue[
            legacyInterval as keyof typeof legacyIntervalToNewValue
        ]
    }

    return undefined
}

const legacyToCurrentCovidQueryParams = (
    queryStr: string,
    baseQueryStr?: string
): QueryParams => {
    const queryParams = strToQueryParams(queryStr)
    const baseQueryParams = strToQueryParams(baseQueryStr)

    const { aligned, perCapita, ...restQueryParams } = omit(
        {
            ...baseQueryParams,
            ...queryParams,
        },
        "casesMetric",
        "deathsMetric",
        "cfrMetric",
        "testsMetric",
        "testsPerCaseMetric",
        "positiveTestRate",
        "vaccinationsMetric",
        "interval",
        "smoothing",
        "totalFreq",
        "dailyFreq"
    ) as QueryParams

    const explorerQueryParams: QueryParams = {
        "Metric Dropdown":
            covidMetricFromLegacyQueryParams(queryParams) ??
            covidMetricFromLegacyQueryParams(baseQueryParams),
        "Interval Dropdown":
            covidIntervalFromLegacyQueryParams(queryParams) ??
            covidIntervalFromLegacyQueryParams(baseQueryParams),
        "Align outbreaks Checkbox": aligned ? "true" : "false",
        "Relative to Population Checkbox": perCapita ? "true" : "false",
    }

    const patch = patchFromQueryParams({
        ...restQueryParams,
        ...explorerQueryParams,
    })

    return {
        patch: patch.uriEncodedString,
    }
}

export enum ExplorerUrlMigrationId {
    legacyToGridCovidExplorer = "legacyToGridCovidExplorer",
}

interface ExplorerUrlMigrationSpec {
    explorerSlug: string
    migrateUrl: (url: Url, baseQueryStr: string) => Url
}

export const explorerUrlMigrationsById: Record<
    ExplorerUrlMigrationId,
    ExplorerUrlMigrationSpec
> = {
    legacyToGridCovidExplorer: {
        explorerSlug: "coronavirus-data-explorer",
        migrateUrl: (url, baseQueryStr) => {
            url = legacyToCurrentGrapherUrl(url)
            let baseUrl = legacyToCurrentGrapherUrl(
                Url.fromQueryStr(baseQueryStr)
            )
            url = url.update({
                pathname: `/${EXPLORERS_ROUTE_FOLDER}/coronavirus-data-explorer`,
                queryStr: queryParamsToStr(
                    legacyToCurrentCovidQueryParams(
                        url.queryStr,
                        baseUrl.queryStr
                    )
                ),
            })
            return url
        },
    },
}

const decodeURIComponentOrUndefined = (value: string | undefined) =>
    value !== undefined ? decodeURIComponent(value) : undefined

const co2QueryParamTransformMap: Record<
    string,
    {
        newName: string
        transformValue: (value: string | undefined) => string | undefined
    }
> = {
    [encodeURIComponent("Gas ")]: {
        newName: "Gas Radio",
        transformValue: decodeURIComponentOrUndefined,
    },
    [encodeURIComponent("Accounting ")]: {
        newName: "Accounting Radio",
        transformValue: decodeURIComponentOrUndefined,
    },
    [encodeURIComponent("Fuel ")]: {
        newName: "Fuel Dropdown",
        transformValue: decodeURIComponentOrUndefined,
    },
    [encodeURIComponent("Count ")]: {
        newName: "Count Dropdown",
        transformValue: decodeURIComponentOrUndefined,
    },
    [encodeURIComponent("Relative to world total ")]: {
        newName: "Relative to world total Checkbox",
        transformValue: (value) => (value ? "true" : "false"),
    },
}

const legacyToCurrentCO2QueryParams = (queryParams: Readonly<QueryParams>) => {
    const newQueryParams = { ...queryParams }
    for (const oldParamName in co2QueryParamTransformMap) {
        if (!(oldParamName in newQueryParams)) continue
        const { newName, transformValue } = co2QueryParamTransformMap[
            oldParamName
        ]
        newQueryParams[newName] = transformValue(queryParams[oldParamName])
        delete newQueryParams[oldParamName]
    }
    return newQueryParams
}

const explorerUrlMigrationsByExplorerSlug: Record<string, UrlMigration> = {
    co2: (url) => {
        // if there is no patch param, then it's an old URL
        if (!url.queryParams.patch) {
            url = legacyToCurrentGrapherUrl(url)
            const queryParams = legacyToCurrentCO2QueryParams(url.queryParams)
            return url.setQueryParams({
                patch: patchFromQueryParams(queryParams).uriEncodedString,
            })
        }
        return url
    },
}

const getExplorerSlugFromPath = (path: string): string | undefined => {
    const match = path.match(
        new RegExp(`^\/+${EXPLORERS_ROUTE_FOLDER}\/+([^\/]+)`)
    )
    if (match && match[1]) return match[1]
    return undefined
}

export const migrateExplorerUrl: UrlMigration = (url: Url): Url => {
    if (!url.pathname) return url

    const explorerSlug = getExplorerSlugFromPath(url.pathname)
    if (!explorerSlug) return url

    const migrateUrl = explorerUrlMigrationsByExplorerSlug[explorerSlug]
    if (!migrateUrl) return url

    return migrateUrl(url)
}

/**
 * An object spec that gets encoded into pages that redirect to an explorer.
 *
 * It's encoded as a JSON object on the page in order to avoid storing all redirects
 * in the client-side bundle.
 */
export interface ExplorerPageUrlMigrationSpec {
    explorerUrlMigrationId: ExplorerUrlMigrationId
    baseQueryStr: string
}
