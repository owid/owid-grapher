import { pick } from "@ourworldindata/utils"
import { GRAPHER_QUERY_PARAM_KEYS } from "@ourworldindata/types"

export function getGrapherFilters(
    searchParams: URLSearchParams
): Record<string, string> | undefined {
    const params = searchParams.size
        ? Object.fromEntries(searchParams)
        : undefined
    if (!params) return undefined
    // delete url query params that the download api uses but that are not related to grapher.
    // Might want to store these in a separate object in the future
    delete params.v1
    delete params.csvType
    delete params.useColumnShortNames
    return pick(params, GRAPHER_QUERY_PARAM_KEYS)
}
