#! yarn testJest

import { Url } from "./Url"

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
})
