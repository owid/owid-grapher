import { describe, expect, it } from "vitest"
import { createOwidUrlResolver, SqlQueryFn } from "./urlResolver.js"

interface FakeGdoc {
    id: string
    slug: string
    type: string
    published?: boolean
}

function fakeDb(options: {
    redirects?: Record<string, string>
    gdocs?: FakeGdoc[]
}): { query: SqlQueryFn; queryCount: () => number } {
    let count = 0
    const query: SqlQueryFn = async (sql, parameters) => {
        count++
        if (sql.includes("FROM redirects")) {
            const target = options.redirects?.[String(parameters![0])]
            return target ? [{ target }] : []
        }
        if (sql.includes("FROM posts_gdocs")) {
            const [slug, ...types] = parameters as string[]
            return (options.gdocs ?? [])
                .filter(
                    (gdoc) =>
                        gdoc.slug === slug &&
                        types.includes(gdoc.type) &&
                        gdoc.published !== false
                )
                .map((gdoc) => ({ id: gdoc.id }))
        }
        throw new Error(`unexpected sql: ${sql}`)
    }
    return { query, queryCount: () => count }
}

const lifeExpectancyGdoc: FakeGdoc = {
    id: "gdoc-abc",
    slug: "life-expectancy",
    type: "article",
}

describe(createOwidUrlResolver, () => {
    it("resolves a direct article slug", async () => {
        const { query } = fakeDb({ gdocs: [lifeExpectancyGdoc] })
        const resolve = createOwidUrlResolver(query)
        expect(
            await resolve("https://ourworldindata.org/life-expectancy")
        ).toEqual("https://docs.google.com/document/d/gdoc-abc/edit")
        // www host and trailing slash also work
        expect(
            await resolve("https://www.ourworldindata.org/life-expectancy/")
        ).toEqual("https://docs.google.com/document/d/gdoc-abc/edit")
    })

    it("follows exact-match redirect chains", async () => {
        const { query } = fakeDb({
            redirects: {
                "/old-slug": "/interim-slug",
                "/interim-slug": "https://ourworldindata.org/life-expectancy",
            },
            gdocs: [lifeExpectancyGdoc],
        })
        const resolve = createOwidUrlResolver(query)
        expect(await resolve("https://ourworldindata.org/old-slug")).toEqual(
            "https://docs.google.com/document/d/gdoc-abc/edit"
        )
    })

    it("returns null on redirect cycles", async () => {
        const { query } = fakeDb({
            redirects: { "/a": "/b", "/b": "/a" },
            gdocs: [],
        })
        const resolve = createOwidUrlResolver(query)
        expect(await resolve("https://ourworldindata.org/a")).toBeNull()
    })

    it("resolves prefixed paths type-aware", async () => {
        const { query } = fakeDb({
            gdocs: [
                { id: "gdoc-di", slug: "some-insight", type: "data-insight" },
                { id: "gdoc-author", slug: "jane-doe", type: "author" },
                // same slug as the data insight, but an article — must not match
                { id: "gdoc-article", slug: "some-insight", type: "article" },
            ],
        })
        const resolve = createOwidUrlResolver(query)
        expect(
            await resolve(
                "https://ourworldindata.org/data-insights/some-insight"
            )
        ).toEqual("https://docs.google.com/document/d/gdoc-di/edit")
        expect(
            await resolve("https://ourworldindata.org/team/jane-doe")
        ).toEqual("https://docs.google.com/document/d/gdoc-author/edit")
    })

    it.each([
        ["grapher pages", "https://ourworldindata.org/grapher/life-expectancy"],
        ["explorer pages", "https://ourworldindata.org/explorers/co2"],
        ["external hosts", "https://example.com/life-expectancy"],
        [
            "query strings",
            "https://ourworldindata.org/life-expectancy?tab=chart",
        ],
        ["anchors", "https://ourworldindata.org/life-expectancy#key-insights"],
        ["the homepage", "https://ourworldindata.org/"],
        [
            "gdoc urls (idempotency)",
            "https://docs.google.com/document/d/gdoc-abc/edit",
        ],
        ["non-urls", "not a url"],
    ])("returns null for %s", async (_description, url) => {
        const { query } = fakeDb({ gdocs: [lifeExpectancyGdoc] })
        const resolve = createOwidUrlResolver(query)
        expect(await resolve(url)).toBeNull()
    })

    it("returns null for ambiguous and unpublished slugs", async () => {
        const { query } = fakeDb({
            gdocs: [
                { id: "gdoc-1", slug: "poverty", type: "article" },
                { id: "gdoc-2", slug: "poverty", type: "topic-page" },
                {
                    id: "gdoc-3",
                    slug: "draft-page",
                    type: "article",
                    published: false,
                },
            ],
        })
        const resolve = createOwidUrlResolver(query)
        expect(await resolve("https://ourworldindata.org/poverty")).toBeNull()
        expect(
            await resolve("https://ourworldindata.org/draft-page")
        ).toBeNull()
    })

    it("caches results per resolver instance", async () => {
        const { query, queryCount } = fakeDb({ gdocs: [lifeExpectancyGdoc] })
        const resolve = createOwidUrlResolver(query)
        await resolve("https://ourworldindata.org/life-expectancy")
        const countAfterFirst = queryCount()
        await resolve("https://ourworldindata.org/life-expectancy")
        expect(queryCount()).toEqual(countAfterFirst)
    })
})
