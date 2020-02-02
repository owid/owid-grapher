import { each, filter, isEmpty } from "charts/Util"

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

    const querySplit = filter(queryStr.split("&"), s => !isEmpty(s))
    const params: QueryParams = {}

    for (const param of querySplit) {
        const pair = param.split("=")
        params[pair[0]] = pair[1]
    }

    return params
}

export function queryParamsToStr(params: QueryParams) {
    let newQueryStr = ""

    each(params, (v, k) => {
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

export function decodeQueryParam(s: string) {
    return decodeURIComponent(s.replace(/\+/g, " "))
}
