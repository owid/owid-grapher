import { describe, expect, it } from "vitest"
import { parseRedirectsFile, RedirectMatcher } from "./cloudflareRedirects.js"

describe(parseRedirectsFile, () => {
    it("parses rules and skips comments and blank lines", () => {
        const rules = parseRedirectsFile(`
# a comment
/feed /atom.xml 302

/blog /latest
/entries/* /:splat 301
`)
        expect(rules).toEqual([
            {
                source: "/feed",
                target: "/atom.xml",
                status: 302,
                isDynamic: false,
            },
            {
                source: "/blog",
                target: "/latest",
                status: 302,
                isDynamic: false,
            },
            {
                source: "/entries/*",
                target: "/:splat",
                status: 301,
                isDynamic: true,
            },
        ])
    })
})

describe(RedirectMatcher, () => {
    const matcher = RedirectMatcher.fromFileContents(`
/feed /atom.xml 302
/countries /search 301
/old-post /new-post 301
/grapher/old-chart /grapher/new-chart?tab=map 302
/*/ /:splat 301
/entries/* /:splat 301
/uploads/* https://assets.ourworldindata.org/uploads/:splat 301
/:slug/country/:country /profile/:slug/:country 301
/entries/special /special-entry 301
`)

    it("matches static rules", () => {
        expect(matcher.match("/feed")?.target).toBe("/atom.xml")
        expect(matcher.match("/countries")?.target).toBe("/search")
        expect(matcher.match("/grapher/old-chart")?.target).toBe(
            "/grapher/new-chart?tab=map"
        )
    })

    it("returns undefined when nothing matches", () => {
        expect(matcher.match("/nothing-here")).toBeUndefined()
    })

    it("substitutes splats", () => {
        expect(matcher.match("/entries/some/nested/path")?.target).toBe(
            "/some/nested/path"
        )
        expect(matcher.match("/uploads/2022/03/image.png")?.target).toBe(
            "https://assets.ourworldindata.org/uploads/2022/03/image.png"
        )
    })

    it("strips trailing slashes via the splat rule", () => {
        expect(matcher.match("/old-post/")?.target).toBe("/old-post")
        expect(matcher.match("/a/b/c/")?.target).toBe("/a/b/c")
    })

    it("substitutes placeholders, matching a single path segment each", () => {
        expect(matcher.match("/co2/country/canada")?.target).toBe(
            "/profile/co2/canada"
        )
        expect(matcher.match("/co2/extra/country/canada")).toBeUndefined()
    })

    it("prefers static rules over dynamic ones regardless of order", () => {
        expect(matcher.match("/entries/special")?.target).toBe("/special-entry")
    })

    it("does not match partial paths", () => {
        expect(matcher.match("/feed/extra")).toBeUndefined()
        expect(matcher.match("/prefix/feed")).toBeUndefined()
    })

    it("treats regex characters in sources literally", () => {
        const m = RedirectMatcher.fromFileContents("/what.is.this /answer 301")
        expect(m.match("/what.is.this")?.target).toBe("/answer")
        expect(m.match("/whatXisXthis")).toBeUndefined()
    })
})
