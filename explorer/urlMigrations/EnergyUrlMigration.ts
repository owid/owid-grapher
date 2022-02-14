import { legacyToCurrentGrapherUrl } from "../../grapher/core/GrapherUrlMigrations.js"
import { Url } from "../../clientUtils/urls/Url.js"
import { UrlMigration } from "../../clientUtils/urls/UrlMigration.js"
import {
    decodeURIComponentOrUndefined,
    getExplorerSlugFromUrl,
    QueryParamTransformMap,
    transformQueryParams,
} from "./ExplorerUrlMigrationUtils.js"

const EXPLORER_SLUG = "energy"

const energyQueryParamTransformMap: QueryParamTransformMap = {
    "Total or Breakdown ": {
        newName: "Total or Breakdown",
        transformValue: decodeURIComponentOrUndefined,
    },
    "Select a source ": {
        newName: "Select a source",
        transformValue: decodeURIComponentOrUndefined,
    },
    "Energy or Electricity ": {
        newName: "Energy or Electricity",
        transformValue: decodeURIComponentOrUndefined,
    },
    "Metric ": {
        newName: "Metric",
        transformValue: decodeURIComponentOrUndefined,
    },
}

export const energyUrlMigration: UrlMigration = (url: Url) => {
    // if it's not the /explorer/energy path, skip it
    const explorerSlug = getExplorerSlugFromUrl(url)
    if (explorerSlug !== EXPLORER_SLUG) return url
    url = legacyToCurrentGrapherUrl(url)
    const queryParams = transformQueryParams(
        url.queryParams,
        energyQueryParamTransformMap
    )
    return url.setQueryParams(queryParams)
}
