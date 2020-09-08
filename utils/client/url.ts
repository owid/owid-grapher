import { isEmpty } from "grapher/utils/Util"

export interface QueryParams {
    [key: string]: string | undefined
}

// Deprecated. Use getWindowQueryParams() to get the params from the global URL,
// or strToQueryParams(str) to parse an arbtirary query string.
export function getQueryParams(queryStr?: string): QueryParams {
    return strToQueryParams(queryStr || getWindowQueryStr())
}

export function getWindowQueryParams(): QueryParams {
    return strToQueryParams(getWindowQueryStr())
}

export function strToQueryParams(queryStr: string): QueryParams {
    if (queryStr[0] === "?") queryStr = queryStr.substring(1)

    const querySplit = queryStr.split("&").filter((s) => !isEmpty(s))
    const params: QueryParams = {}

    for (const param of querySplit) {
        const pair = param.split("=")
        params[pair[0]] = pair[1]
    }

    return params
}

export function queryParamsToStr(params: QueryParams) {
    let newQueryStr = ""

    Object.entries(params).forEach(([k, v]) => {
        if (v === undefined) return

        if (isEmpty(newQueryStr)) newQueryStr += "?"
        else newQueryStr += "&"
        newQueryStr += k + "=" + v
    })

    return newQueryStr
}

export function setWindowQueryVariable(key: string, val: string | null) {
    const params = getWindowQueryParams()

    if (val === null || val === "") {
        delete params[key]
    } else {
        params[key] = val
    }

    setWindowQueryStr(queryParamsToStr(params))
}

export function getWindowQueryStr() {
    return window.location.search
}

export function setWindowQueryStr(str: string) {
    history.replaceState(
        null,
        document.title,
        window.location.pathname + str + window.location.hash
    )
}

export function splitURLintoPathAndQueryString(
    url: string
): { path: string; queryString: string | undefined } {
    const [path, queryString] = url.split(/\?/)
    return { path: path, queryString: queryString }
}
