import { ALGOLIA_INDEX_PREFIX } from "../../settings/clientSettings.js"
import { SearchIndexName } from "./searchTypes.js"

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

export const DEFAULT_SEARCH_PLACEHOLDER =
    "Try “Life expectancy”, “Poverty Nigeria Vietnam”, “CO2 France”…"
