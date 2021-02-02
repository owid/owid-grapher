import { QueryParams } from "../../clientUtils/url"
import { omitUndefinedValues } from "../../clientUtils/Util"
import { EntityUrlBuilder } from "../../grapher/core/EntityUrlBuilder"
import { Patch } from "../../patch/Patch"
import { Url } from "../../urls/Url"
import { EXPLORERS_ROUTE_FOLDER } from "../ExplorerConstants"

export const patchFromQueryParams = (queryParams: QueryParams): Patch => {
    return new Patch(
        omitUndefinedValues({
            ...queryParams,
            // If we don't encode it as an array,
            // Patch will escape the column delimiter.
            selection: queryParams.selection
                ? EntityUrlBuilder.queryParamToEntityNames(
                      queryParams.selection
                  )
                : undefined,
        })
    )
}

export const decodeURIComponentOrUndefined = (value: string | undefined) =>
    value !== undefined ? decodeURIComponent(value) : undefined

export type QueryParamTransformMap = Record<
    string,
    {
        newName: string
        transformValue: (value: string | undefined) => string | undefined
    }
>

export const transformQueryParams = (
    queryParams: Readonly<QueryParams>,
    transformMap: QueryParamTransformMap
) => {
    const newQueryParams = { ...queryParams }
    for (const oldParamName in transformMap) {
        if (!(oldParamName in newQueryParams)) continue
        const { newName, transformValue } = transformMap[oldParamName]
        newQueryParams[newName] = transformValue(queryParams[oldParamName])
        delete newQueryParams[oldParamName]
    }
    return newQueryParams
}

export const getExplorerSlugFromUrl = (url: Url): string | undefined => {
    if (!url.pathname) return undefined
    const match = url.pathname.match(
        new RegExp(`^\/+${EXPLORERS_ROUTE_FOLDER}\/+([^\/]+)`)
    )
    if (match && match[1]) return match[1]
    return undefined
}
