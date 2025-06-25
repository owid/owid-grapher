import * as _ from "lodash-es"
import { GRAPHER_QUERY_PARAM_KEYS } from "@ourworldindata/types"

export function getGrapherFilters(
    searchParams: URLSearchParams,
    multiDimAvailableDimensions?: string[]
): Record<string, string> | undefined {
    const params = searchParams.size
        ? Object.fromEntries(searchParams)
        : undefined
    if (!params) return undefined
    // delete url query params that the download api uses but that are not related to grapher
    delete params.v1
    delete params.csvType
    delete params.useColumnShortNames
    return _.pick(params, [
        ...GRAPHER_QUERY_PARAM_KEYS,
        ...(multiDimAvailableDimensions ?? []),
    ])
}
