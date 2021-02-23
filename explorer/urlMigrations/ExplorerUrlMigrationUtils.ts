import { QueryParams } from "../../clientUtils/url"
import { Url } from "../../urls/Url"
import { EXPLORERS_ROUTE_FOLDER } from "../ExplorerConstants"

export const decodeURIComponentOrUndefined = (value: string | undefined) =>
    value !== undefined
        ? decodeURIComponent(value.replace(/\+/g, "%20"))
        : undefined

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
