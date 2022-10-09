import { Url, QueryParams } from "@ourworldindata/utils"

import { EXPLORERS_ROUTE_FOLDER } from "../ExplorerConstants.js"
import { identity, omit } from "@ourworldindata/utils"

export const decodeURIComponentOrUndefined = (value: string | undefined) =>
    value !== undefined
        ? decodeURIComponent(value.replace(/\+/g, "%20"))
        : undefined

export type QueryParamTransformMap = Record<
    string,
    {
        newName?: string
        transformValue?: (value: string | undefined) => string | undefined
    }
>

export const transformQueryParams = (
    oldQueryParams: Readonly<QueryParams>,
    transformMap: QueryParamTransformMap
) => {
    const newQueryParams = omit(
        oldQueryParams,
        ...Object.keys(transformMap)
    ) as QueryParams
    for (const oldParamName in transformMap) {
        if (!(oldParamName in oldQueryParams)) continue
        const { newName, transformValue } = transformMap[oldParamName]
        const name = newName ?? oldParamName
        const transform = transformValue ?? identity
        newQueryParams[name] = transform(oldQueryParams[oldParamName])
    }
    return newQueryParams
}

// todo(refactor): merge with Url's get explorerSlug()
export const getExplorerSlugFromUrl = (url: Url): string | undefined => {
    if (!url.pathname) return undefined
    const match = url.pathname.match(
        new RegExp(`^\/+${EXPLORERS_ROUTE_FOLDER}\/+([^\/]+)`)
    )
    if (match && match[1]) return match[1]
    return undefined
}
