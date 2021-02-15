import { isEmpty, omitUndefinedValues } from "./Util"

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
 */
export const strToQueryParams = (queryStr = ""): QueryParams => {
    if (queryStr[0] === "?") queryStr = queryStr.substring(1)

    const querySplit = queryStr.split("&").filter((s) => !isEmpty(s))
    const params: QueryParams = {}

    for (const param of querySplit) {
        const [key, value] = param.split("=", 2)
        params[key] =
            value === undefined ? undefined : decodeURIComponent(value)
    }

    return params
}

/**
 * Converts an object to a query string.
 * Expects the input object to not be encoded already, and handles the URI-encoding of the values.
 */
export const queryParamsToStr = (params: QueryParams) => {
    const newQueryStr = Object.entries(omitUndefinedValues(params))
        .map(([key, value]) => [key, encodeURIComponent(value)]) // URI-encode values
        .map(([key, value]) => `${key}=${value}`) // map into key=value string
        .join("&") // join strings using `&`

    return newQueryStr.length ? `?${newQueryStr}` : ""
}

export const setWindowQueryVariable = (key: string, val: string | null) => {
    const params = getWindowQueryParams()

    if (val === null || val === "") delete params[key]
    else params[key] = val

    setWindowQueryStr(queryParamsToStr(params))
}

export const getWindowQueryStr = () => window.location.search

export const setWindowQueryStr = (str: string) =>
    history.replaceState(
        null,
        document.title,
        window.location.pathname + str + window.location.hash
    )

export const splitURLintoPathAndQueryString = (
    url: string
): { path: string; queryString: string | undefined } => {
    const [path, queryString] = url.split(/\?/)
    return { path: path, queryString: queryString }
}
