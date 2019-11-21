import { filter, each, isEmpty } from "charts/Util"

export interface QueryParams {
    [key: string]: string | undefined
}

export function getQueryParams(queryStr?: string): QueryParams {
    queryStr = queryStr || window.location.search
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

export function setQueryVariable(key: string, val: string | null) {
    const params = getQueryParams()

    if (val === null || val === "") {
        delete params[key]
    } else {
        params[key] = val
    }

    setQueryStr(queryParamsToStr(params))
}

export function setQueryStr(str: string) {
    history.replaceState(
        null,
        document.title,
        window.location.pathname + str + window.location.hash
    )
}

export function decodeQueryParam(s: string) {
    return decodeURIComponent(s.replace(/\+/g, " "))
}
