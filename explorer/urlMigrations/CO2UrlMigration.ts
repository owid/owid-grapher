import { legacyToCurrentGrapherUrl } from "../../grapher/core/GrapherUrlMigrations"
import { Url } from "../../urls/Url"
import { UrlMigration } from "../../urls/UrlMigration"
import {
    decodeURIComponentOrUndefined,
    getExplorerSlugFromUrl,
    patchFromQueryParams,
    QueryParamTransformMap,
    transformQueryParams,
} from "./ExplorerUrlMigrationUtils"

const EXPLORER_SLUG = "co2"

const co2QueryParamTransformMap: QueryParamTransformMap = {
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

export const co2UrlMigration: UrlMigration = (url: Url) => {
    // if it's not the /explorer/co2 path, skip it
    const explorerSlug = getExplorerSlugFromUrl(url)
    if (explorerSlug !== EXPLORER_SLUG) return url

    // if there is no patch param, then it's an old URL
    if (!url.queryParams._original.patch) {
        url = legacyToCurrentGrapherUrl(url)
        const queryParams = transformQueryParams(
            url.queryParams._original,
            co2QueryParamTransformMap
        )
        return url.setQueryParams({
            patch: patchFromQueryParams(queryParams).uriEncodedString,
        })
    }
    return url
}
