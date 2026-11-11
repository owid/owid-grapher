import { MultiDimDimensionChoices, QueryParams } from "@ourworldindata/types"
import { omitUndefinedValues } from "../Util.js"

/**
 * Converts a query string into an object of key-value pairs, with URI-decoded
 * keys and values. A leading `?` is ignored, a repeated key keeps its last
 * value, and a key without a value (`?foo`) maps to an empty string.
 */
export const strToQueryParams = (queryStr = ""): QueryParams =>
    Object.fromEntries(new URLSearchParams(queryStr))

/**
 * Like `strToQueryParams`, but leaves the values URI-encoded.
 * Only use when absolutely necessary, for example, to distinguish between
 * `+` and `%20` for legacy URLs.
 */
export const strToEncodedQueryParams = (queryStr = ""): QueryParams => {
    if (queryStr[0] === "?") queryStr = queryStr.substring(1)

    const params: QueryParams = {}
    for (const param of queryStr.split("&").filter((s) => s)) {
        const [key, value] = param.split("=", 2)
        params[safeDecodeURIComponent(key.replace(/\+/g, "%20"))] = value
    }
    return params
}

/**
 * `decodeURIComponent` that returns the input unchanged instead of throwing
 * on malformed escapes such as a lone `%`.
 */
export const safeDecodeURIComponent = (str: string): string => {
    try {
        return decodeURIComponent(str)
    } catch {
        return str
    }
}

/**
 * Converts an object to a query string.
 * Expects the input object to not be encoded already, and handles the URI-encoding of the values.
 */
export const queryParamsToStr = (params: QueryParams): string => {
    const queryParams = new URLSearchParams(omitUndefinedValues(params))

    // we're relying on `~` (%7E) to not be encoded in some places, so make sure that it never is
    const newQueryStr = queryParams.toString().replace(/%7E/g, "~")
    return newQueryStr.length ? `?${newQueryStr}` : ""
}

/**
 * Serialize a multi-dim view's dimension choices into a canonical query
 * string, e.g. `antigen=hepb_bd&metric=vaccinated`. The parameters are sorted
 * so the same view always produces the same string; this is used as the
 * view's identifier.
 */
export function multiDimDimensionsToViewQueryStr(
    dimensions: MultiDimDimensionChoices
): string {
    const searchParams = new URLSearchParams(dimensions)
    searchParams.sort()
    return searchParams.toString()
}

export const getWindowQueryStr = (): string => window.location.search

export const setWindowQueryStr = (str: string): void =>
    history.replaceState(
        null,
        document.title,
        window.location.pathname + str + window.location.hash
    )
