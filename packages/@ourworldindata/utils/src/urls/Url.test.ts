import { expect, it, describe } from "vitest"

import { Url } from "./Url.js"

describe(Url, () => {
    const url = Url.fromURL(
        "https://ourworldindata.org/grapher/abc?stackMode=relative&country=USA~SWE#heading"
    )

    it("props", () => {
        expect(url.origin).toEqual("https://ourworldindata.org")
        expect(url.pathname).toEqual("/grapher/abc")
        expect(url.queryStr).toEqual("?stackMode=relative&country=USA~SWE")
        expect(url.hash).toEqual("#heading")
    })

    it("fromQueryStr() correctly formats queryStr", () => {
        expect(Url.fromQueryStr("test=123&abc").queryStr).toEqual(
            "?test=123&abc"
        )
    })

    it("update() correctly formats queryStr", () => {
        expect(url.update({ queryStr: "test=123&abc" }).queryStr).toEqual(
            "?test=123&abc"
        )
    })

    it("update() correctly formats hash", () => {
        expect(url.update({ hash: "test" }).hash).toEqual("#test")
    })

    it("update() doesn't set pathname to undefined if origin is defined", () => {
        const newUrl = url.update({ pathname: undefined })
        expect(newUrl.pathname).toEqual("")
    })

    it("update() sets pathname to undefined if origin is undefined", () => {
        const newUrl = url.update({ pathname: undefined, origin: undefined })
        expect(newUrl.origin).toBeUndefined()
        expect(newUrl.pathname).toBeUndefined()
    })

    it("updateQueryParams() deletes undefined props", () => {
        expect(
            url.updateQueryParams({ stackMode: undefined }).queryStr
        ).toEqual("?country=USA~SWE")
    })

    it("fromQueryStr() leaves pathname and origin undefined", () => {
        const url = Url.fromQueryStr("a=1&b=2")
        expect(url.origin).toBeUndefined()
        expect(url.pathname).toBeUndefined()
        expect(url.originAndPath).toBeUndefined()
    })

    it("Url with empty query string drops query string", () => {
        const url = Url.fromURL("https://owid.cloud/?")
        expect(url.fullUrl).toEqual("https://owid.cloud/")
    })

    it("correctly formats originAndPath", () => {
        expect(
            Url.fromURL("https://ourworldindata.org/grapher/123?abc=true#hash")
                .originAndPath
        ).toEqual("https://ourworldindata.org/grapher/123")
        expect(Url.fromURL("/grapher/123?abc=true#hash").originAndPath).toEqual(
            "/grapher/123"
        )
    })

    it("detects grapher pages restrictively", () => {
        expect(url.isGrapher).toBe(true)
        expect(
            Url.fromURL("https://ourworldindata.org/not/a/grapher/page")
                .isGrapher
        ).toBe(false)
    })

    it("detects explorer pages restrictively", () => {
        expect(url.isExplorer).toBe(false)
        expect(
            Url.fromURL("https://ourworldindata.org/not/an/explorers/page")
                .isExplorer
        ).toBe(false)
        expect(
            Url.fromURL("https://ourworldindata.org/explorers").isExplorer
        ).toBe(false)
        expect(
            Url.fromURL("https://ourworldindata.org/explorers/").isExplorer
        ).toBe(false)
        expect(
            Url.fromURL("https://ourworldindata.org/explorers/co2").isExplorer
        ).toBe(true)
        expect(
            Url.fromURL("https://ourworldindata.org/explorers/12-co2")
                .isExplorer
        ).toBe(true)
    })

    it("detects uploads restrictively", () => {
        expect(
            Url.fromURL("https://ourworldindata.org/uploads/file.png").isUpload
        ).toBe(true)
        expect(
            Url.fromURL(
                "https://ourworldindata.org/not/supported/uploads/file.png"
            ).isUpload
        ).toBe(false)
    })

    it("prints URL with no trailing slash", () => {
        const urlSlash = Url.fromURL("https://ourworldindata.org/")
        expect(urlSlash.fullUrlNoTrailingSlash).toEqual(
            "https://ourworldindata.org"
        )
        const urlNoSlash = Url.fromURL("https://ourworldindata.org")
        expect(urlNoSlash.fullUrlNoTrailingSlash).toEqual(
            "https://ourworldindata.org"
        )
    })

    it("prints path with no trailing slash", () => {
        const urlSlash = Url.fromURL("/grapher/abc/")
        expect(urlSlash.fullUrlNoTrailingSlash).toEqual("/grapher/abc")
        const urlNoSlash = Url.fromURL("/grapher/abc")
        expect(urlNoSlash.fullUrlNoTrailingSlash).toEqual("/grapher/abc")
    })

    it("prints URL with only trailing slash when no origin", () => {
        const url = Url.fromURL("/")
        expect(url.fullUrlNoTrailingSlash).toEqual("/")
    })

    const slugTestCases = [
        { url: "https://ourworldindata.org/", slug: "" },
        { url: "https://ourworldindata.org/grapher/abc", slug: "abc" },
        { url: "https://ourworldindata.org/grapher/123-xyz", slug: "123-xyz" },
        {
            url: "https://ourworldindata.org/grapher/with-hash#section",
            slug: "with-hash",
        },
        {
            url: "https://ourworldindata.org/grapher/with-dash?abc=123",
            slug: "with-dash",
        },
        {
            url: "/grapher/relative-path",
            slug: "relative-path",
        },
    ]

    it.each(slugTestCases)(
        "correctly extracts slug from $url",
        ({ url, slug }) => {
            expect(Url.fromURL(url).slug).toEqual(slug)
        }
    )

    describe("areQueryParamsEqual", () => {
        it("returns true for identical query params", () => {
            const url1 = Url.fromURL("https://example.com/?a=1&b=2")
            const url2 = Url.fromURL("https://example.com/?a=1&b=2")
            expect(url1.areQueryParamsEqual(url2)).toBe(true)
        })

        it("returns true when order is different", () => {
            const url1 = Url.fromURL("https://example.com/?a=1&b=2")
            const url2 = Url.fromURL("https://example.com/?b=2&a=1")
            expect(url1.areQueryParamsEqual(url2)).toBe(true)
        })

        it("returns false when there are different number of params", () => {
            const url1 = Url.fromURL("https://example.com/?a=1&b=2")
            const url2 = Url.fromURL("https://example.com/?a=1&b=2&c=3")
            expect(url1.areQueryParamsEqual(url2)).toBe(false)
        })

        it("returns false when param values differ", () => {
            const url1 = Url.fromURL("https://example.com/?a=1&b=2")
            const url2 = Url.fromURL("https://example.com/?a=1&b=3")
            expect(url1.areQueryParamsEqual(url2)).toBe(false)
        })

        it("returns false when param keys differ", () => {
            const url1 = Url.fromURL("https://example.com/?a=1&b=2")
            const url2 = Url.fromURL("https://example.com/?a=1&c=2")
            expect(url1.areQueryParamsEqual(url2)).toBe(false)
        })

        it("returns true even when domain is different", () => {
            const url1 = Url.fromURL("https://example.com/?a=1&b=2")
            const url2 = Url.fromURL("https://other-thing.com/?a=1&b=2")
            expect(url1.areQueryParamsEqual(url2)).toBe(true)
        })
    })
})
