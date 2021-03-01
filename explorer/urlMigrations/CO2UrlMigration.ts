import { legacyToCurrentGrapherUrl } from "../../grapher/core/GrapherUrlMigrations"
import { Url } from "../../clientUtils/urls/Url"
import { UrlMigration } from "../../clientUtils/urls/UrlMigration"
import {
    decodeURIComponentOrUndefined,
    getExplorerSlugFromUrl,
    QueryParamTransformMap,
    transformQueryParams,
} from "./ExplorerUrlMigrationUtils"

const EXPLORER_SLUG = "co2"

const co2QueryParamTransformMap: QueryParamTransformMap = {
    "Gas ": {
        newName: "Gas",
        transformValue: decodeURIComponentOrUndefined,
    },
    "Accounting ": {
        newName: "Accounting",
        transformValue: decodeURIComponentOrUndefined,
    },
    "Fuel ": {
        newName: "Fuel",
        transformValue: decodeURIComponentOrUndefined,
    },
    "Count ": {
        newName: "Count",
        transformValue: decodeURIComponentOrUndefined,
    },
    "Relative to world total ": {
        newName: "Relative to world total",
        transformValue: (value) => (value ? "true" : "false"),
    },
}

export const co2UrlMigration: UrlMigration = (url: Url) => {
    // if it's not the /explorer/co2 path, skip it
    const explorerSlug = getExplorerSlugFromUrl(url)
    if (explorerSlug !== EXPLORER_SLUG) return url

    url = legacyToCurrentGrapherUrl(url)
    const queryParams = transformQueryParams(
        url.queryParams,
        co2QueryParamTransformMap
    )
    return url.setQueryParams(queryParams)
}
