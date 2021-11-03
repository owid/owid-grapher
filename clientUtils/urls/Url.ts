import urlParseLib from "url-parse"

import { excludeUndefined, omitUndefinedValues } from "../Util"

import { QueryParams, queryParamsToStr, strToQueryParams } from "./UrlUtils"

const parseUrl = (url: string) => {
    const parsed = urlParseLib(url, {})
    // The library returns an unparsed string for `query`, its types aren't quite right.
    const query = parsed.query.toString()
    return {
        ...parsed,
        query,
    }
}

const ensureStartsWith = (str: string, start: string): string => {
    if (str.startsWith(start)) return str
    return `${start}${str}`
}

const ensureQueryStrFormat = (queryStr: string) =>
    ensureStartsWith(queryStr, "?")
const ensureHashFormat = (queryStr: string) => ensureStartsWith(queryStr, "#")

interface UrlProps {
    readonly origin?: string // https://ourworldindata.org
    readonly pathname?: string // /grapher/abc
    readonly queryStr?: string // ?stackMode=relative
    readonly hash?: string // #articles
}

export class Url {
    private props: UrlProps

    /**
     * @param url Absolute or relative URL
     */
    static fromURL(url: string) {
        const { origin, pathname, query, hash } = parseUrl(url)
        return new Url({
            origin:
                origin !== undefined && origin !== "null" ? origin : undefined,
            pathname,
            queryStr: query,
            hash,
        })
    }

    static fromQueryStr(queryStr: string) {
        return new Url({
            queryStr: ensureQueryStrFormat(queryStr),
        })
    }

    static fromQueryParams(queryParams: QueryParams) {
        return new Url({
            queryStr: queryParamsToStr(queryParams),
        })
    }

    private constructor(props: UrlProps = {}) {
        this.props = {
            ...props,
            pathname:
                props.pathname !== undefined
                    ? props.pathname
                    : props.origin
                    ? ""
                    : undefined,
        }
    }

    get origin(): string | undefined {
        return this.props.origin
    }

    get pathname(): string | undefined {
        return this.props.pathname
    }

    get slug(): string | undefined {
        return this.props.pathname?.replace(/^\/+/, "")
    }

    get originAndPath(): string | undefined {
        const strings = excludeUndefined([this.origin, this.pathname])
        if (strings.length === 0) return undefined
        return strings.join("")
    }

    get queryStr(): string {
        const { queryStr } = this.props
        // Drop a single trailing `?`, if there is one
        return queryStr && queryStr !== "?"
            ? ensureQueryStrFormat(queryStr)
            : ""
    }

    get hash(): string {
        const { hash } = this.props
        return hash ? ensureHashFormat(hash) : ""
    }

    get fullUrl(): string {
        return excludeUndefined([
            this.origin,
            this.pathname,
            this.queryStr,
            this.hash,
        ]).join("")
    }

    get queryParams(): QueryParams {
        return strToQueryParams(this.queryStr)
    }

    get encodedQueryParams(): QueryParams {
        return strToQueryParams(this.queryStr, true)
    }

    get isGrapher(): boolean {
        return this.pathname ? /\/grapher\//.test(this.pathname) : false
    }

    update(props: UrlProps) {
        return new Url({
            ...this.props,
            ...props,
        })
    }

    setQueryParams(queryParams: QueryParams) {
        return new Url({
            ...this.props,
            queryStr: queryParamsToStr(queryParams),
        })
    }

    updateQueryParams(queryParams: QueryParams) {
        return this.update({
            queryStr: queryParamsToStr(
                omitUndefinedValues({
                    ...this.queryParams,
                    ...queryParams,
                })
            ),
        })
    }
}

export const setWindowUrl = (url: Url): void => {
    const pathname = url.pathname ?? window.location.pathname
    window.history.replaceState(
        null,
        document.title,
        excludeUndefined([pathname, url.queryStr, url.hash]).join("")
    )
}

export const getWindowUrl = (): Url => {
    return Url.fromURL(window.location.href)
}
