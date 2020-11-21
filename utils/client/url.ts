import { isEmpty } from "grapher/utils/Util"

export interface QueryParams {
    [key: string]: string | undefined
}

// Deprecated. Use getWindowQueryParams() to get the params from the global URL,
// or strToQueryParams(str) to parse an arbtirary query string.
export const getQueryParams = (queryStr?: string): QueryParams =>
    strToQueryParams(queryStr || getWindowQueryStr())

export const getWindowQueryParams = (): QueryParams =>
    strToQueryParams(getWindowQueryStr())

export const strToQueryParams = (queryStr = ""): QueryParams => {
    if (queryStr[0] === "?") queryStr = queryStr.substring(1)

    const querySplit = queryStr.split("&").filter((s) => !isEmpty(s))
    const params: QueryParams = {}

    for (const param of querySplit) {
        const pair = param.split("=")
        params[pair[0]] = pair[1]
    }

    return params
}

export const queryParamsToStr = (params: QueryParams) => {
    let newQueryStr = ""

    Object.entries(params).forEach(([key, value]) => {
        if (value === undefined) return

        if (isEmpty(newQueryStr)) newQueryStr += "?"
        else newQueryStr += "&"
        newQueryStr += key + "=" + value
    })

    return newQueryStr
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
