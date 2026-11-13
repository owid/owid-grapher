import { expect, it, describe } from "vitest"
import { isEmptyQuerySearchPayload } from "./emptyQuerySearchPayload.js"

describe(isEmptyQuerySearchPayload, () => {
    it("accepts requests with an empty or absent query", () => {
        expect(
            isEmptyQuerySearchPayload({
                requests: [
                    { indexName: "charts", query: "" },
                    { indexName: "pages" },
                ],
            })
        ).toBe(true)
    })

    it("accepts empty queries nested in a params object (autocomplete)", () => {
        expect(
            isEmptyQuerySearchPayload({
                requests: [
                    { indexName: "charts", params: { query: "", page: 0 } },
                ],
            })
        ).toBe(true)
    })

    it("accepts empty queries in a URL-encoded params string (legacy)", () => {
        expect(
            isEmptyQuerySearchPayload({
                requests: [
                    { indexName: "charts", params: "query=&hitsPerPage=4" },
                ],
            })
        ).toBe(true)
    })

    it("rejects payloads containing a non-empty query", () => {
        expect(
            isEmptyQuerySearchPayload({
                requests: [
                    { indexName: "charts", query: "" },
                    { indexName: "pages", query: "co2" },
                ],
            })
        ).toBe(false)
        expect(
            isEmptyQuerySearchPayload({
                requests: [{ indexName: "charts", params: { query: "co2" } }],
            })
        ).toBe(false)
        expect(
            isEmptyQuerySearchPayload({
                requests: [{ indexName: "charts", params: "query=co2" }],
            })
        ).toBe(false)
    })

    it("rejects payloads containing a similarQuery or facetQuery", () => {
        expect(
            isEmptyQuerySearchPayload({
                requests: [{ indexName: "charts", similarQuery: "co2" }],
            })
        ).toBe(false)
        expect(
            isEmptyQuerySearchPayload({
                requests: [
                    { indexName: "charts", params: { facetQuery: "co2" } },
                ],
            })
        ).toBe(false)
    })

    it("rejects an empty query filtered on a pinned search, which holds the reader's search", () => {
        const filters = 'type:featured-viz AND pinnedForSearches:"population"'
        expect(
            isEmptyQuerySearchPayload({
                requests: [{ indexName: "pages", query: "", filters }],
            })
        ).toBe(false)
        expect(
            isEmptyQuerySearchPayload({
                requests: [
                    { indexName: "pages", params: { query: "", filters } },
                ],
            })
        ).toBe(false)
    })

    it("still accepts an empty query with ordinary filters (e.g. /latest, data insights)", () => {
        expect(
            isEmptyQuerySearchPayload({
                requests: [
                    { indexName: "pages", query: "", filters: "type:article" },
                ],
            })
        ).toBe(true)
    })

    it("rejects malformed payloads", () => {
        expect(isEmptyQuerySearchPayload(undefined)).toBe(false)
        expect(isEmptyQuerySearchPayload(null)).toBe(false)
        expect(isEmptyQuerySearchPayload("query")).toBe(false)
        expect(isEmptyQuerySearchPayload({})).toBe(false)
        expect(isEmptyQuerySearchPayload({ requests: [] })).toBe(false)
        expect(isEmptyQuerySearchPayload({ requests: ["query"] })).toBe(false)
        expect(isEmptyQuerySearchPayload({ requests: [{ params: 1 }] })).toBe(
            false
        )
    })
})
