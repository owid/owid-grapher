/**
 * All the tests in here are skipped, currently, because mocking SQL/S3 calls is difficult:
 * see https://vitest.dev/guide/mocking#mocking-pitfalls
 */

import { vi, it, expect } from "vitest"

import { Url, strToQueryParams } from "@ourworldindata/utils"
import { formatUrls } from "../site/formatting.js"
import * as redirects from "./redirects.js"
import { resolveInternalRedirect } from "./redirects.js"

import { KnexReadonlyTransaction } from "../db/db.js"

type ArrayForMap = [string, string][]

const getGrapherAndWordpressRedirectsMap = vi.spyOn(
    redirects,
    "getGrapherAndWordpressRedirectsMap"
)

const getFormattedUrl = (url: string): Url => {
    return Url.fromURL(formatUrls(url))
}

it.skip("resolves pathnames", async () => {
    const src = "/hello"
    const target = "/world"
    const redirectsArr: ArrayForMap = [[src, target]]

    const urlToResolve = getFormattedUrl(src)
    const resolvedUrl = getFormattedUrl(target)

    getGrapherAndWordpressRedirectsMap.mockImplementation(() =>
        Promise.resolve(new Map(redirectsArr))
    )

    expect(
        await resolveInternalRedirect(
            urlToResolve,
            {} as KnexReadonlyTransaction
        )
    ).toEqual(resolvedUrl)
})

it.skip("does not support query string in redirects map", async () => {
    const src = "/hello?q=1"
    const target = "/world"
    const redirectsArr: ArrayForMap = [[src, target]]

    const urlToResolve = getFormattedUrl(src)

    getGrapherAndWordpressRedirectsMap.mockImplementation(() =>
        Promise.resolve(new Map(redirectsArr))
    )

    expect(
        await resolveInternalRedirect(
            urlToResolve,
            {} as KnexReadonlyTransaction
        )
    ).toEqual(urlToResolve)
})

it.skip("passes query string params when resolving", async () => {
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

    getGrapherAndWordpressRedirectsMap.mockImplementation(() =>
        Promise.resolve(new Map(redirectsArr))
    )

    expect(
        await resolveInternalRedirect(
            urlToResolve,
            {} as KnexReadonlyTransaction
        )
    ).toEqual(resolvedUrl)
})

it.skip("does not pass query string params when some present on the target", async () => {
    const src = "/hello"
    const target = "/world?q=1"
    const redirectsArr: ArrayForMap = [[src, target]]

    const urlToResolve = getFormattedUrl(src).setQueryParams(
        strToQueryParams("?z=2")
    )
    const resolvedUrl = getFormattedUrl(target)

    getGrapherAndWordpressRedirectsMap.mockImplementation(() =>
        Promise.resolve(new Map(redirectsArr))
    )

    expect(
        await resolveInternalRedirect(
            urlToResolve,
            {} as KnexReadonlyTransaction
        )
    ).toEqual(resolvedUrl)
})

it.skip("resolves self-redirects", async () => {
    const src = "/hello"
    const target = "/hello"
    const redirectsArr: ArrayForMap = [[src, target]]

    const urlToResolve = getFormattedUrl(src)

    getGrapherAndWordpressRedirectsMap.mockImplementation(() =>
        Promise.resolve(new Map(redirectsArr))
    )

    expect(
        await resolveInternalRedirect(
            urlToResolve,
            {} as KnexReadonlyTransaction
        )
    ).toEqual(urlToResolve)
})

it.skip("does not support query params in self-redirects", async () => {
    const src = "/hello"
    const target = "/hello?q=1"
    const redirectsArr: ArrayForMap = [[src, target]]

    const urlToResolve = getFormattedUrl(src)
    const urlToResolveWithQueryParam = getFormattedUrl(src).setQueryParams(
        strToQueryParams("?z=2")
    )

    getGrapherAndWordpressRedirectsMap.mockImplementation(() =>
        Promise.resolve(new Map(redirectsArr))
    )

    expect(
        await resolveInternalRedirect(
            urlToResolve,
            {} as KnexReadonlyTransaction
        )
    ).toEqual(urlToResolve)
    expect(
        await resolveInternalRedirect(
            urlToResolveWithQueryParam,
            {} as KnexReadonlyTransaction
        )
    ).toEqual(urlToResolveWithQueryParam)
})

it.skip("resolves circular redirects", async () => {
    const theKing = "/the-king"
    const isDead = "/is-dead"
    const longLive = "/long-live"
    const redirectsArr: ArrayForMap = [
        [theKing, isDead],
        [isDead, longLive],
        [longLive, theKing],
    ]

    const urlToResolve = getFormattedUrl(theKing)

    getGrapherAndWordpressRedirectsMap.mockImplementation(() =>
        Promise.resolve(new Map(redirectsArr))
    )

    expect(
        await resolveInternalRedirect(
            urlToResolve,
            {} as KnexReadonlyTransaction
        )
    ).toEqual(urlToResolve)
})
