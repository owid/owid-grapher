import urlParseLib from "url-parse"

import { excludeUndefined, omitUndefinedValues } from "../Util.js"

import { QueryParams, queryParamsToStr, strToQueryParams } from "./UrlUtils.js"

const parseUrl = (
    url: string
): Omit<urlParseLib, "query"> & { query: string } => {
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

const ensureQueryStrFormat = (queryStr: string): string =>
    ensureStartsWith(queryStr, "?")
const ensureHashFormat = (queryStr: string): string =>
    ensureStartsWith(queryStr, "#")

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
    static fromURL(url: string): Url {
        const { origin, pathname, query, hash } = parseUrl(url)
        return new Url({
            origin:
                origin !== undefined && origin !== "null" ? origin : undefined,
            pathname,
            queryStr: query,
            hash,
        })
    }

    static fromQueryStr(queryStr: string): Url {
        return new Url({
            queryStr: ensureQueryStrFormat(queryStr),
        })
    }

    static fromQueryParams(queryParams: QueryParams): Url {
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
        return this.props.pathname?.split("/").pop()
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
        return !!(this.pathname && /^\/grapher\/[\w]+/.test(this.pathname))
    }

    get isUpload(): boolean {
        return !!(this.pathname && /^\/uploads\/[\w]+/.test(this.pathname))
    }

    // todo(refactor): move outisde of generic Url class
    // see EXPLORERS_ROUTE_FOLDER
    get isExplorer(): boolean {
        return !!(this.pathname && /^\/explorers\/[\w]+/.test(this.pathname))
    }

    update(props: UrlProps): Url {
        return new Url({
            ...this.props,
            ...props,
        })
    }

    setQueryParams(queryParams: QueryParams): Url {
        return new Url({
            ...this.props,
            queryStr: queryParamsToStr(queryParams),
        })
    }

    updateQueryParams(queryParams: QueryParams): Url {
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
