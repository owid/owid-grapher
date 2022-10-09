import { Url, UrlMigration } from "@ourworldindata/utils"
import {
    getExplorerSlugFromUrl,
    QueryParamTransformMap,
    transformQueryParams,
} from "./ExplorerUrlMigrationUtils.js"

const EXPLORER_SLUG = "coronavirus-data-explorer"

const transformMap: QueryParamTransformMap = {
    Metric: {
        transformValue: (value) => {
            // Since we introduced multiple vaccinations metrics, we want to
            // differentiate between them.
            // And while we're there, reduce the length of "Tests per confirmed
            // case", because it wraps to 2 lines.
            //
            // -@danielgavrilov, 2021-03-30
            //
            if (value === "Vaccinations") return "Vaccine doses"
            if (value === "Tests per confirmed case") return "Tests per case"
            return value
        },
    },
    "Align outbreaks": {
        newName: "Color by test positivity",
    },
}

export const covidUrlMigration: UrlMigration = (url: Url) => {
    // if it's not the /explorer/energy path, skip it
    const explorerSlug = getExplorerSlugFromUrl(url)
    if (explorerSlug !== EXPLORER_SLUG) return url
    return url.setQueryParams(
        transformQueryParams(url.queryParams, transformMap)
    )
}
