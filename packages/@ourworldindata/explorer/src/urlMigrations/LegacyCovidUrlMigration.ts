import * as _ from "lodash-es"
import { legacyToCurrentGrapherUrl } from "@ourworldindata/grapher"
import { QueryParams, Url } from "@ourworldindata/utils"
import { EXPLORERS_ROUTE_FOLDER } from "../ExplorerConstants.js"
import { ExplorerUrlMigrationSpec } from "./ExplorerUrlMigrations.js"

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

const legacyIntervalToNewValue = {
    daily: "New per day",
    weekly: "Weekly",
    total: "Cumulative",
    smoothed: "7-day rolling average",
    biweekly: "Biweekly",
    weeklyChange: "Weekly change",
    biweeklyChange: "Biweekly change",
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

const boolParamToString = (bool: boolean | string | undefined) =>
    bool === "true" || bool === "false" ? bool : bool ? "true" : "false"

const legacyToCurrentCovidQueryParams = (
    queryParams: QueryParams,
    baseQueryParams: QueryParams = {}
): QueryParams => {
    const restQueryParams = _.omit(
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
        "dailyFreq",
        "aligned",
        "perCapita"
    )

    const urlContainsMetric = !!covidMetricFromLegacyQueryParams(queryParams)

    // For the following params, use the modern query param if it exists, otherwise
    // fall back to trying to convert the legacy one.
    const explorerQueryParams: QueryParams = {
        Metric:
            queryParams.Metric ??
            baseQueryParams.Metric ??
            covidMetricFromLegacyQueryParams(queryParams) ??
            covidMetricFromLegacyQueryParams(baseQueryParams),
        Interval:
            queryParams.Interval ??
            baseQueryParams.Interval ??
            covidIntervalFromLegacyQueryParams(queryParams) ??
            covidIntervalFromLegacyQueryParams(baseQueryParams),
        "Align outbreaks": boolParamToString(
            queryParams["Align outbreaks"] ??
                baseQueryParams["Align outbreaks"] ??
                (urlContainsMetric
                    ? queryParams.aligned
                    : baseQueryParams.aligned)
        ),
        "Relative to Population": boolParamToString(
            queryParams["Relative to Population"] ??
                baseQueryParams["Relative to Population"] ??
                (urlContainsMetric
                    ? queryParams.perCapita
                    : baseQueryParams.perCapita)
        ),
    }

    return {
        ...restQueryParams,
        ...explorerQueryParams,
    }
}

export const legacyCovidMigrationSpec: ExplorerUrlMigrationSpec = {
    explorerSlug: "covid",
    migrateUrl: (url, baseQueryStr) => {
        // Migrate the Grapher query params in both URLs
        const [explorerUrl, baseUrl] = [
            url,
            Url.fromQueryStr(baseQueryStr),
        ].map(legacyToCurrentGrapherUrl)

        return explorerUrl
            .setQueryParams(
                legacyToCurrentCovidQueryParams(
                    explorerUrl.queryParams,
                    baseUrl.queryParams
                )
            )
            .update({
                pathname: `/${EXPLORERS_ROUTE_FOLDER}/covid`,
            })
    },
}
