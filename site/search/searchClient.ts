import { ALGOLIA_INDEX_PREFIX } from "../../settings/clientSettings.js"
import { SearchIndexName } from "@ourworldindata/types"

export const getIndexName = (index: SearchIndexName | string): string => {
    if (ALGOLIA_INDEX_PREFIX !== "") {
        return `${ALGOLIA_INDEX_PREFIX}-${index}`
    }
    return index
}

export const DEFAULT_SEARCH_PLACEHOLDER =
    "Try “Life expectancy”, “Poverty Nigeria Vietnam”, “CO2 France”…"
