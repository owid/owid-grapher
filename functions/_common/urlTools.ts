export function getGrapherFilters(
    searchParams: URLSearchParams
): Record<string, unknown> {
    const params = searchParams.size
        ? Object.fromEntries(searchParams)
        : undefined
    // delete url query params that the download api uses but that are not related to grapher
    delete params.v1
    delete params.csvType
    delete params.useColumnShortNames
    return params
}
