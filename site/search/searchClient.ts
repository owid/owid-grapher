import {
    ALGOLIA_ID,
    ALGOLIA_SEARCH_KEY,
} from "../../settings/clientSettings.js"
import insightsClient, { InsightsClient } from "search-insights"
import type { InsightsSearchClickEvent } from "search-insights/dist/click.js"
import {
    getPreferenceValue,
    PreferenceType,
} from "../CookiePreferencesManager.js"

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

export const logSiteSearchClick = (
    event: Omit<InsightsSearchClickEvent, "eventName">
) => {
    const client = getInsightsClient()
    client("clickedObjectIDsAfterSearch", { ...event, eventName: "click" })
}

export const DEFAULT_SEARCH_PLACEHOLDER =
    "Try “Life expectancy”, “Economic Growth”, “Homicide rate”, “Biodiversity”…"
