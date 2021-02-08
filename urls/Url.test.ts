#! yarn testJest

import { Url } from "./Url"

describe(Url, () => {
    const url = Url.fromURL(
        "https://ourworldindata.org/grapher/abc?stackMode=relative&country=USA~SWE#heading"
    )

    it("props", () => {
        expect(url.base).toEqual("https://ourworldindata.org")
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

    it("update() doesn't set pathname to undefined if base is defined", () => {
        const newUrl = url.update({ pathname: undefined })
        expect(newUrl.pathname).toEqual("")
    })

    it("update() sets pathname to undefined if base is undefined", () => {
        const newUrl = url.update({ pathname: undefined, base: undefined })
        expect(newUrl.base).toBeUndefined()
        expect(newUrl.pathname).toBeUndefined()
    })

    it("updateQueryParams() deletes undefined props", () => {
        expect(
            url.updateQueryParams({ stackMode: undefined }).queryStr
        ).toEqual("?country=USA~SWE")
    })

    it("fromQueryStr() leaves pathname and base undefined", () => {
        const url = Url.fromQueryStr("a=1&b=2")
        expect(url.base).toBeUndefined()
        expect(url.pathname).toBeUndefined()
    })

    it("Url with empty query string drops query string", () => {
        const url = Url.fromURL("https://owid.cloud/?")
        expect(url.fullUrl).toEqual("https://owid.cloud/")
    })
})
