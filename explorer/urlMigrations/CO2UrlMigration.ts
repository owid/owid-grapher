import { QueryParams } from "../../clientUtils/url"
import { legacyToCurrentGrapherUrl } from "../../grapher/core/GrapherUrlMigrations"
import { Url } from "../../urls/Url"
import { UrlMigration } from "../../urls/UrlMigration"
import {
    decodeURIComponentOrUndefined,
    patchFromQueryParams,
} from "./ExplorerUrlMigrationUtils"

const co2QueryParamTransformMap: Record<
    string,
    {
        newName: string
        transformValue: (value: string | undefined) => string | undefined
    }
> = {
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

const legacyToCurrentCO2QueryParams = (queryParams: Readonly<QueryParams>) => {
    const newQueryParams = { ...queryParams }
    for (const oldParamName in co2QueryParamTransformMap) {
        if (!(oldParamName in newQueryParams)) continue
        const { newName, transformValue } = co2QueryParamTransformMap[
            oldParamName
        ]
        newQueryParams[newName] = transformValue(queryParams[oldParamName])
        delete newQueryParams[oldParamName]
    }
    return newQueryParams
}

export const co2UrlMigration: UrlMigration = (url: Url) => {
    // if there is no patch param, then it's an old URL
    if (!url.queryParams.patch) {
        url = legacyToCurrentGrapherUrl(url)
        const queryParams = legacyToCurrentCO2QueryParams(url.queryParams)
        return url.setQueryParams({
            patch: patchFromQueryParams(queryParams).uriEncodedString,
        })
    }
    return url
}
