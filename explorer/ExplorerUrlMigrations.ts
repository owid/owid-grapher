import { Url } from "../urls/Url"

import {
    QueryParams,
    queryParamsToStr,
    strToQueryParams,
} from "../clientUtils/url"
import { omit, omitUndefinedValues } from "../clientUtils/Util"
import { DefaultPatchGrammar, Patch } from "../patch/Patch"
import { legacyToCurrentGrapherUrl } from "../grapher/core/GrapherInterface"
import { EXPLORERS_ROUTE_FOLDER } from "./ExplorerConstants"

const legacyIntervalToNewValue = {
    daily: "New per day",
    weekly: "Weekly",
    total: "Cumulative",
    smoothed: "7-day rolling average",
    biweekly: "Biweekly",
    weeklyChange: "Weekly change",
    biweeklyChange: "Biweekly change",
}

const metricFromLegacyQueryParams = (queryParams: QueryParams) => {
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

const intervalFromLegacyQueryParams = (queryParams: QueryParams) => {
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

    const { aligned, perCapita, selection, ...restQueryParams } = omit(
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
            metricFromLegacyQueryParams(queryParams) ??
            metricFromLegacyQueryParams(baseQueryParams),
        "Interval Dropdown":
            intervalFromLegacyQueryParams(queryParams) ??
            intervalFromLegacyQueryParams(baseQueryParams),
        "Align outbreaks Checkbox": aligned ? "true" : "false",
        "Relative to Population Checkbox": perCapita ? "true" : "false",
    }

    const patch = new Patch(
        omitUndefinedValues({
            ...restQueryParams,
            ...explorerQueryParams,
            // If we don't encode it as an array,
            // Patch will escape the column delimiter.
            selection: selection?.split(DefaultPatchGrammar.columnDelimiter),
        })
    )

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

export interface ExplorerPageUrlMigrationSpec {
    explorerUrlMigrationId: ExplorerUrlMigrationId
    baseQueryStr: string
}
