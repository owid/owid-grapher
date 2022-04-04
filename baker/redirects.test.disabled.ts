import { Url } from "../clientUtils/urls/Url.js"
import { strToQueryParams } from "../clientUtils/urls/UrlUtils.js"
import { formatUrls } from "../site/formatting.js"
import * as redirects from "./redirects.js"
import { resolveInternalRedirect } from "./redirects.js"
import { jest } from "@jest/globals"

jest.mock("../settings/clientSettings.js", () => ({
    WORDPRESS_URL: "http://localhost:8080",
    BAKED_BASE_URL: "http://localhost:3030",
}))

type ArrayForMap = [string, string][]

const getGrapherAndWordpressRedirectsMap = jest.spyOn(
    redirects,
    "getGrapherAndWordpressRedirectsMap"
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

    getGrapherAndWordpressRedirectsMap.mockImplementation(() =>
        Promise.resolve(new Map(redirectsArr))
    )

    expect(await resolveInternalRedirect(urlToResolve)).toEqual(resolvedUrl)
})

it("does not support query string in redirects map", async () => {
    const src = "/hello?q=1"
    const target = "/world"
    const redirectsArr: ArrayForMap = [[src, target]]

    const urlToResolve = getFormattedUrl(src)

    getGrapherAndWordpressRedirectsMap.mockImplementation(() =>
        Promise.resolve(new Map(redirectsArr))
    )

    expect(await resolveInternalRedirect(urlToResolve)).toEqual(urlToResolve)
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

    getGrapherAndWordpressRedirectsMap.mockImplementation(() =>
        Promise.resolve(new Map(redirectsArr))
    )

    expect(await resolveInternalRedirect(urlToResolve)).toEqual(resolvedUrl)
})

it("does not pass query string params when some present on the target", async () => {
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

    expect(await resolveInternalRedirect(urlToResolve)).toEqual(resolvedUrl)
})

it("resolves self-redirects", async () => {
    const src = "/hello"
    const target = "/hello"
    const redirectsArr: ArrayForMap = [[src, target]]

    const urlToResolve = getFormattedUrl(src)

    getGrapherAndWordpressRedirectsMap.mockImplementation(() =>
        Promise.resolve(new Map(redirectsArr))
    )

    expect(await resolveInternalRedirect(urlToResolve)).toEqual(urlToResolve)
})

it("does not support query params in self-redirects", async () => {
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

    expect(await resolveInternalRedirect(urlToResolve)).toEqual(urlToResolve)
    expect(await resolveInternalRedirect(urlToResolveWithQueryParam)).toEqual(
        urlToResolveWithQueryParam
    )
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

    getGrapherAndWordpressRedirectsMap.mockImplementation(() =>
        Promise.resolve(new Map(redirectsArr))
    )

    expect(await resolveInternalRedirect(urlToResolve)).toEqual(urlToResolve)
})
