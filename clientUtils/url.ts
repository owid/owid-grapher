import { isEmpty, omitUndefinedValues } from "./Util"

export interface QueryParams {
    [key: string]: string | undefined
}

export interface EncodedDecodedQueryParams {
    _original: QueryParams
    decoded: QueryParams
}

// Deprecated. Use getWindowQueryParams() to get the params from the global URL,
// or strToQueryParams(str) to parse an arbtirary query string.
export const getQueryParams = (queryStr?: string): EncodedDecodedQueryParams =>
    strToQueryParams(queryStr || getWindowQueryStr())

export const getWindowQueryParams = (): EncodedDecodedQueryParams =>
    strToQueryParams(getWindowQueryStr())

/**
 * Converts a query string into an object of key-value pairs.
 * Handles URI-decoding of the values.
 */
export const strToQueryParams = (queryStr = ""): EncodedDecodedQueryParams => {
    if (queryStr[0] === "?") queryStr = queryStr.substring(1)

    const querySplit = queryStr.split("&").filter((s) => !isEmpty(s))
    const params: EncodedDecodedQueryParams = { _original: {}, decoded: {} }

    for (const param of querySplit) {
        const [key, value] = param.split("=", 2)
        const decoded =
            value !== undefined
                ? decodeURIComponent(value.replace(/\+/g, "%20"))
                : undefined

        params._original[key] = value
        params.decoded[key] = decoded
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

export const setWindowQueryVariable = (key: string, val: string | null) => {
    const params = getWindowQueryParams().decoded

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
