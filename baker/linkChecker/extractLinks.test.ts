import { describe, expect, it } from "vitest"
import { extractInternalLinks, toInternalLink } from "./extractLinks.js"

const baseUrl = new URL("https://ourworldindata.org")
const hosts = new Set(["ourworldindata.org", "www.ourworldindata.org"])

describe(toInternalLink, () => {
    it("accepts root-relative and absolute internal URLs", () => {
        expect(toInternalLink("/donate", baseUrl, hosts)).toMatchObject({
            pathname: "/donate",
            search: "",
        })
        expect(
            toInternalLink(
                "https://ourworldindata.org/grapher/life-expectancy?tab=map#foo",
                baseUrl,
                hosts
            )
        ).toMatchObject({
            pathname: "/grapher/life-expectancy",
            search: "?tab=map",
        })
        expect(
            toInternalLink("//www.ourworldindata.org/about", baseUrl, hosts)
        ).toMatchObject({ pathname: "/about" })
    })

    it("resolves relative paths against the base URL", () => {
        expect(toInternalLink("about", baseUrl, hosts)).toMatchObject({
            pathname: "/about",
        })
    })

    it("decodes percent-encoded paths", () => {
        expect(
            toInternalLink("/grapher/caf%C3%A9-consumption", baseUrl, hosts)
        ).toMatchObject({ pathname: "/grapher/café-consumption" })
    })

    it("rejects external, non-http and same-page links", () => {
        expect(
            toInternalLink("https://github.com/owid", baseUrl, hosts)
        ).toBeUndefined()
        expect(
            toInternalLink("mailto:info@example.org", baseUrl, hosts)
        ).toBeUndefined()
        expect(
            toInternalLink("javascript:void(0)", baseUrl, hosts)
        ).toBeUndefined()
        expect(
            toInternalLink("data:image/png;base64,AAAA", baseUrl, hosts)
        ).toBeUndefined()
        expect(toInternalLink("#section", baseUrl, hosts)).toBeUndefined()
        expect(toInternalLink("?tab=map", baseUrl, hosts)).toBeUndefined()
        expect(toInternalLink("   ", baseUrl, hosts)).toBeUndefined()
    })
})

describe(extractInternalLinks, () => {
    it("collects URLs from the relevant attributes", () => {
        const html = `
            <html><head>
                <link rel="stylesheet" href="/assets/owid.css">
                <script src="https://ourworldindata.org/assets/owid.js"></script>
                <meta property="og:image" content="/default-thumbnail.png">
            </head><body>
                <a href="/grapher/life-expectancy">chart</a>
                <a href="https://github.com/owid">external</a>
                <a href="#top">anchor</a>
                <img src="/images/a.png" srcset="/images/a-400.png 400w, /images/a-800.png 800w">
                <iframe src="https://ourworldindata.org/grapher/child-mortality?tab=chart"></iframe>
                <form action="/search"></form>
            </body></html>`
        const links = extractInternalLinks(html, baseUrl).map(
            (link) => `${link.pathname}${link.search}`
        )
        expect(links).toEqual([
            "/grapher/life-expectancy",
            "/assets/owid.css",
            "/images/a.png",
            "/images/a-400.png",
            "/images/a-800.png",
            "/assets/owid.js",
            "/grapher/child-mortality?tab=chart",
            "/search",
            "/default-thumbnail.png",
        ])
    })

    it("treats the bake's own host as internal", () => {
        const html = `<a href="http://localhost:3030/grapher/foo">x</a><a href="https://ourworldindata.org/bar">y</a>`
        const links = extractInternalLinks(
            html,
            new URL("http://localhost:3030")
        ).map((link) => link.pathname)
        expect(links).toEqual(["/grapher/foo", "/bar"])
    })
})
