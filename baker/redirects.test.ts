import { vi, it, expect } from "vitest"

import { Url, strToQueryParams } from "@ourworldindata/utils"
import { formatUrls } from "../site/formatting.js"
import * as redirectsFromDb from "./redirectsFromDb.js"
import { DEPRECATED_resolveInternalRedirectForWordpressProminentLinks } from "./redirects.js"

import { KnexReadonlyTransaction } from "../db/db.js"

type ArrayForMap = [string, string][]

const getAllRedirectsMap = vi.spyOn(
    redirectsFromDb,
    "DEPRECATED_getAllRedirectsMap"
)

const getFormattedUrl = (url: string): Url => {
    return Url.fromURL(formatUrls(url))
}

it("resolves pathnames", async () => {
    const src = "/hello"
    const target = "/world"
    const redirectsArr: ArrayForMap = [[src, target]]

    const urlToResolve = getFormattedUrl(src)
    const resolvedUrl = getFormattedUrl(target)

    getAllRedirectsMap.mockImplementation(() =>
        Promise.resolve(new Map(redirectsArr))
    )

    expect(
        await DEPRECATED_resolveInternalRedirectForWordpressProminentLinks(
            urlToResolve,
            {} as KnexReadonlyTransaction
        )
    ).toEqual(resolvedUrl)
})

it("does not support query string in redirects map", async () => {
    const src = "/hello?q=1"
    const target = "/world"
    const redirectsArr: ArrayForMap = [[src, target]]

    const urlToResolve = getFormattedUrl(src)

    getAllRedirectsMap.mockImplementation(() =>
        Promise.resolve(new Map(redirectsArr))
    )

    expect(
        await DEPRECATED_resolveInternalRedirectForWordpressProminentLinks(
            urlToResolve,
            {} as KnexReadonlyTransaction
        )
    ).toEqual(urlToResolve)
})

it("passes query string params when resolving", async () => {
    const src = "/hello"
    const target = "/world"
    const redirectsArr: ArrayForMap = [[src, target]]
    const queryString = "?q=1"

    const urlToResolve = getFormattedUrl(src).setQueryParams(
        strToQueryParams(queryString)
    )
    const resolvedUrl = getFormattedUrl(target).setQueryParams(
        strToQueryParams(queryString)
    )

    getAllRedirectsMap.mockImplementation(() =>
        Promise.resolve(new Map(redirectsArr))
    )

    expect(
        await DEPRECATED_resolveInternalRedirectForWordpressProminentLinks(
            urlToResolve,
            {} as KnexReadonlyTransaction
        )
    ).toEqual(resolvedUrl)
})

it("merges source query string params with target params", async () => {
    const src = "/hello"
    const target = "/world?q=1"
    const redirectsArr: ArrayForMap = [[src, target]]

    const urlToResolve = getFormattedUrl(src).setQueryParams(
        strToQueryParams("?z=2")
    )
    // Source params (z=2) should be merged with target params (q=1)
    const resolvedUrl = getFormattedUrl("/world").setQueryParams(
        strToQueryParams("?z=2&q=1")
    )

    getAllRedirectsMap.mockImplementation(() =>
        Promise.resolve(new Map(redirectsArr))
    )

    expect(
        await DEPRECATED_resolveInternalRedirectForWordpressProminentLinks(
            urlToResolve,
            {} as KnexReadonlyTransaction
        )
    ).toEqual(resolvedUrl)
})

it("target params take precedence over source params on conflict", async () => {
    const src = "/hello"
    const target = "/world?tab=chart"
    const redirectsArr: ArrayForMap = [[src, target]]

    // Source has tab=map, but target has tab=chart
    const urlToResolve = getFormattedUrl(src).setQueryParams(
        strToQueryParams("?tab=map&other=value")
    )
    // Target param tab=chart should win, but other=value should be preserved
    const resolvedUrl = getFormattedUrl("/world").setQueryParams(
        strToQueryParams("?tab=chart&other=value")
    )

    getAllRedirectsMap.mockImplementation(() =>
        Promise.resolve(new Map(redirectsArr))
    )

    expect(
        await DEPRECATED_resolveInternalRedirectForWordpressProminentLinks(
            urlToResolve,
            {} as KnexReadonlyTransaction
        )
    ).toEqual(resolvedUrl)
})

it("resolves self-redirects", async () => {
    const src = "/hello"
    const target = "/hello"
    const redirectsArr: ArrayForMap = [[src, target]]

    const urlToResolve = getFormattedUrl(src)

    getAllRedirectsMap.mockImplementation(() =>
        Promise.resolve(new Map(redirectsArr))
    )

    expect(
        await DEPRECATED_resolveInternalRedirectForWordpressProminentLinks(
            urlToResolve,
            {} as KnexReadonlyTransaction
        )
    ).toEqual(urlToResolve)
})

it("does not support query params in self-redirects", async () => {
    const src = "/hello"
    const target = "/hello?q=1"
    const redirectsArr: ArrayForMap = [[src, target]]

    const urlToResolve = getFormattedUrl(src)
    const urlToResolveWithQueryParam = getFormattedUrl(src).setQueryParams(
        strToQueryParams("?z=2")
    )

    getAllRedirectsMap.mockImplementation(() =>
        Promise.resolve(new Map(redirectsArr))
    )

    expect(
        await DEPRECATED_resolveInternalRedirectForWordpressProminentLinks(
            urlToResolve,
            {} as KnexReadonlyTransaction
        )
    ).toEqual(urlToResolve)
    expect(
        await DEPRECATED_resolveInternalRedirectForWordpressProminentLinks(
            urlToResolveWithQueryParam,
            {} as KnexReadonlyTransaction
        )
    ).toEqual(urlToResolveWithQueryParam)
})

it("resolves circular redirects", async () => {
    const theKing = "/the-king"
    const isDead = "/is-dead"
    const longLive = "/long-live"
    const redirectsArr: ArrayForMap = [
        [theKing, isDead],
        [isDead, longLive],
        [longLive, theKing],
    ]

    const urlToResolve = getFormattedUrl(theKing)

    getAllRedirectsMap.mockImplementation(() =>
        Promise.resolve(new Map(redirectsArr))
    )

    expect(
        await DEPRECATED_resolveInternalRedirectForWordpressProminentLinks(
            urlToResolve,
            {} as KnexReadonlyTransaction
        )
    ).toEqual(urlToResolve)
})
