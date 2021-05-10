import { omitUndefinedValues } from "../Util"

export interface QueryParams {
    [key: string]: string | undefined
}

// Deprecated. Use getWindowQueryParams() to get the params from the global URL,
// or strToQueryParams(str) to parse an arbtirary query string.
export const getQueryParams = (queryStr?: string): QueryParams =>
    strToQueryParams(queryStr || getWindowQueryStr())

export const getWindowQueryParams = (): QueryParams =>
    strToQueryParams(getWindowQueryStr())

/**
 * Converts a query string into an object of key-value pairs.
 * Handles URI-decoding of the values.
 * @param queryStr
 * @param doNotDecode Passing `true` will return a QueryParams object with URI-encoded values.
 *                    Only use when absolutely necessary, for example, to distinguish between
 *                    `+` and `%20` for legacy URLs.
 */
export const strToQueryParams = (
    queryStr = "",
    doNotDecode = false
): QueryParams => {
    if (queryStr[0] === "?") queryStr = queryStr.substring(1)

    const querySplit = queryStr.split("&").filter((s) => s)
    const params: QueryParams = {}

    for (const param of querySplit) {
        const [key, value] = param.split("=", 2)
        const decodedKey = decodeURIComponent(key.replace(/\+/g, "%20"))
        const decoded =
            value !== undefined
                ? decodeURIComponent(value.replace(/\+/g, "%20"))
                : undefined

        params[decodedKey] = doNotDecode ? value : decoded
    }

    return params
}

/**
 * Converts an object to a query string.
 * Expects the input object to not be encoded already, and handles the URI-encoding of the values.
 */
export const queryParamsToStr = (params: QueryParams) => {
    const queryParams = new URLSearchParams(omitUndefinedValues(params))

    // we're relying on `~` (%7E) to not be encoded in some places, so make sure that it never is
    const newQueryStr = queryParams.toString().replace(/%7E/g, "~")
    return newQueryStr.length ? `?${newQueryStr}` : ""
}

export const getWindowQueryStr = () => window.location.search

export const setWindowQueryStr = (str: string) =>
    history.replaceState(
        null,
        document.title,
        window.location.pathname + str + window.location.hash
    )
