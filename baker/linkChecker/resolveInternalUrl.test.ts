import { describe, expect, it } from "vitest"
import { RedirectMatcher } from "./cloudflareRedirects.js"
import {
    Resolution,
    resolveInternalUrl,
    ResolverContext,
} from "./resolveInternalUrl.js"

const files = new Set([
    "index.html",
    "404.html",
    "about.html",
    "donate.html",
    "data-insights/some-insight.html",
    "collection/custom.html",
    "latest/index.html",
    "deleted/old-post.html",
    "grapher/life-expectancy.html",
    "grapher/co2-emissions.html",
    "explorers/energy.html",
    "explorers/covid.html",
    "assets/owid.css",
    "images/logo.png",
])

const ctx: ResolverContext = {
    fileExists: (relativePath) => files.has(relativePath),
    redirects: RedirectMatcher.fromFileContents(`
/feed /atom.xml 302
/blog /latest 301
/old-about /about 301
/loop-a /loop-b 301
/loop-b /loop-a 301
/chain-1 /chain-2 301
/chain-2 /about 301
/*/ /:splat 301
/entries/* /:splat 301
/uploads/* https://assets.ourworldindata.org/uploads/:splat 301
`),
    grapherRedirects: {
        "life-expectancy-old": "life-expectancy",
        "co2-old": "co2-emissions?tab=map",
        "self-referential": "self-referential",
        dangling: "does-not-exist",
    },
    explorerRedirects: {
        "energy-old": "life-expectancy",
        "covid-old": {
            type: "decision",
            paramName: "Metric",
            branches: {
                Deaths: {
                    type: "leaf",
                    target: {
                        targetSlug: "co2-emissions",
                        targetQueryParams: { Metric: null, tab: "map" },
                    },
                },
            },
            default: { type: "leaf", target: undefined },
        },
    },
    internalHosts: new Set(["ourworldindata.org", "www.ourworldindata.org"]),
}

const resolve = (url: string): Resolution => {
    const [pathname, query] = url.split("?", 2)
    return resolveInternalUrl(
        { pathname, search: query ? `?${query}` : "" },
        ctx
    )
}

describe(resolveInternalUrl, () => {
    it("resolves static pages and assets", () => {
        expect(resolve("/")).toMatchObject({ status: "ok", kind: "file" })
        expect(resolve("/about")).toMatchObject({ status: "ok", kind: "file" })
        expect(resolve("/about?ref=x")).toMatchObject({ status: "ok" })
        expect(resolve("/about.html")).toMatchObject({ status: "ok" })
        expect(resolve("/data-insights/some-insight")).toMatchObject({
            status: "ok",
        })
        expect(resolve("/collection/custom")).toMatchObject({ status: "ok" })
        expect(resolve("/latest")).toMatchObject({ status: "ok" })
        expect(resolve("/latest/")).toMatchObject({ status: "ok" })
        expect(resolve("/assets/owid.css")).toMatchObject({ status: "ok" })
        expect(resolve("/images/logo.png")).toMatchObject({ status: "ok" })
    })

    it("reports missing pages as broken", () => {
        expect(resolve("/nope")).toMatchObject({
            status: "broken",
            hops: ["/nope"],
        })
        expect(resolve("/images/missing.png")).toMatchObject({
            status: "broken",
        })
        expect(resolve("/grapher")).toMatchObject({ status: "broken" })
    })

    it("follows _redirects rules", () => {
        expect(resolve("/old-about")).toMatchObject({
            status: "ok",
            hops: ["/old-about", "/about"],
        })
        expect(resolve("/about/")).toMatchObject({
            status: "ok",
            hops: ["/about/", "/about"],
        })
        expect(resolve("/entries/about")).toMatchObject({ status: "ok" })
        expect(resolve("/chain-1")).toMatchObject({
            status: "ok",
            hops: ["/chain-1", "/chain-2", "/about"],
        })
        expect(resolve("/blog")).toMatchObject({ status: "ok" })
        expect(resolve("/feed")).toMatchObject({ status: "broken" })
    })

    it("treats redirects to other hosts as resolved", () => {
        expect(resolve("/uploads/2022/image.png")).toMatchObject({
            status: "ok",
            kind: "external-redirect",
        })
    })

    it("detects redirect loops", () => {
        expect(resolve("/loop-a")).toMatchObject({
            status: "too-many-redirects",
            hops: ["/loop-a", "/loop-b", "/loop-a"],
        })
        expect(resolve("/grapher/self-referential")).toMatchObject({
            status: "broken",
        })
    })

    it("resolves grapher pages, slug redirects and case differences", () => {
        expect(resolve("/grapher/life-expectancy")).toMatchObject({
            status: "ok",
            kind: "file",
        })
        expect(
            resolve("/grapher/life-expectancy-old?country=~FRA")
        ).toMatchObject({
            status: "ok",
            hops: [
                "/grapher/life-expectancy-old?country=~FRA",
                "/grapher/life-expectancy?country=%7EFRA",
            ],
        })
        expect(resolve("/grapher/co2-old")).toMatchObject({
            status: "ok",
            hops: ["/grapher/co2-old", "/grapher/co2-emissions?tab=map"],
        })
        expect(resolve("/grapher/Life-Expectancy")).toMatchObject({
            status: "ok",
            hops: ["/grapher/Life-Expectancy", "/grapher/life-expectancy"],
        })
        expect(resolve("/grapher/dangling")).toMatchObject({
            status: "broken",
            hops: ["/grapher/dangling", "/grapher/does-not-exist"],
        })
        expect(resolve("/grapher/unknown")).toMatchObject({ status: "broken" })
    })

    it("resolves grapher dynamic extensions when the chart exists", () => {
        expect(resolve("/grapher/life-expectancy.png?tab=map")).toMatchObject({
            status: "ok",
            kind: "dynamic-route",
        })
        expect(resolve("/grapher/life-expectancy.metadata.json")).toMatchObject(
            {
                status: "ok",
                kind: "dynamic-route",
            }
        )
        expect(resolve("/grapher/life-expectancy-old.csv")).toMatchObject({
            status: "ok",
            hops: [
                "/grapher/life-expectancy-old.csv",
                "/grapher/life-expectancy.csv",
            ],
        })
        expect(resolve("/grapher/unknown.png")).toMatchObject({
            status: "broken",
        })
    })

    it("resolves explorers and their redirects", () => {
        expect(resolve("/explorers/energy")).toMatchObject({
            status: "ok",
            kind: "file",
        })
        expect(resolve("/explorers/energy.csv?tab=map")).toMatchObject({
            status: "ok",
            kind: "dynamic-route",
        })
        expect(resolve("/explorers/Energy")).toMatchObject({
            status: "ok",
            hops: ["/explorers/Energy", "/explorers/energy"],
        })
        expect(resolve("/explorers/energy-old")).toMatchObject({
            status: "ok",
            hops: ["/explorers/energy-old", "/grapher/life-expectancy"],
        })
        expect(resolve("/explorers/unknown")).toMatchObject({
            status: "broken",
        })
    })

    it("follows query-param dependent explorer redirects", () => {
        expect(
            resolve("/explorers/covid-old?Metric=Deaths&country=~USA")
        ).toMatchObject({
            status: "ok",
            hops: [
                "/explorers/covid-old?Metric=Deaths&country=~USA",
                "/grapher/co2-emissions?country=%7EUSA&tab=map",
            ],
        })
        // No matching branch and no explorer page left on disk
        expect(resolve("/explorers/covid-old?Metric=Cases")).toMatchObject({
            status: "broken",
        })
    })

    it("flags tombstones of deleted pages", () => {
        expect(resolve("/deleted/old-post")).toMatchObject({
            status: "tombstone",
        })
    })

    it("assumes function-only routes resolve", () => {
        expect(resolve("/api/search?q=x")).toMatchObject({
            status: "ok",
            kind: "dynamic-route",
        })
        expect(resolve("/grapher/by-uuid/abc-123")).toMatchObject({
            status: "ok",
            kind: "dynamic-route",
        })
        expect(resolve("/multi-dim/energy.json")).toMatchObject({
            status: "ok",
            kind: "dynamic-route",
        })
        expect(resolve("/donation/donate")).toMatchObject({ status: "ok" })
    })
})
