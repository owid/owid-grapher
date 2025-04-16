import {
    ALGOLIA_ID,
    ALGOLIA_INDEX_PREFIX,
    ALGOLIA_SEARCH_KEY,
} from "../../settings/clientSettings.js"
import insightsClient, { InsightsClient } from "search-insights"
import type { InsightsSearchClickEvent } from "search-insights/dist/click.js"
import { getPreferenceValue, PreferenceType } from "../cookiePreferences.js"
import { SearchIndexName } from "./searchTypes.js"

let insightsInitialized = false
const getInsightsClient = (): InsightsClient => {
    if (!insightsInitialized) {
        insightsClient("init", {
            appId: ALGOLIA_ID,
            apiKey: ALGOLIA_SEARCH_KEY,
            useCookie: getPreferenceValue(PreferenceType.Analytics),
        })
        insightsInitialized = true
    }
    return insightsClient
}

export const getIndexName = (index: SearchIndexName | string): string => {
    if (ALGOLIA_INDEX_PREFIX !== "") {
        return `${ALGOLIA_INDEX_PREFIX}-${index}`
    }
    return index
}

export const parseIndexName = (index: string): SearchIndexName => {
    if (ALGOLIA_INDEX_PREFIX !== "") {
        return index.substring(
            ALGOLIA_INDEX_PREFIX.length + 1
        ) as SearchIndexName
    } else {
        return index as SearchIndexName
    }
}

export const logSiteSearchClickToAlgoliaInsights = (
    event: InsightsSearchClickEvent
) => {
    const client = getInsightsClient()
    client("clickedObjectIDsAfterSearch", {
        ...event,
    })
}

export const DEFAULT_SEARCH_PLACEHOLDER =
    "Try “Life expectancy”, “Poverty Nigeria Vietnam”, “CO2 France”…"
