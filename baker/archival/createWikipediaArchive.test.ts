import { describe, it, expect } from "vitest"
import {
    stripGtmScripts,
    rewriteArchiveUrls,
} from "./createWikipediaArchive.js"

describe("stripGtmScripts", () => {
    it("removes GTM inline script (googletagmanager)", () => {
        const html = `<html><head>
            <script>window.dataLayer=window.dataLayer||[];(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-N2D4V8S');</script>
            <title>Test</title>
        </head><body>Hello</body></html>`
        const result = stripGtmScripts(html)
        expect(result).not.toContain("googletagmanager")
        expect(result).toContain("<title>Test</title>")
        expect(result).toContain("Hello")
    })

    it("removes GTM noscript/comment references (Google Tag Manager)", () => {
        const html = `<html><head>
            <script>/* Google Tag Manager */ (function(){})();</script>
        </head><body>Content</body></html>`
        const result = stripGtmScripts(html)
        expect(result).not.toContain("Google Tag Manager")
        expect(result).toContain("Content")
    })

    it("leaves non-GTM scripts untouched", () => {
        const html = `<html><head>
            <script src="/assets/owid.abc123.mjs" type="module"></script>
            <script>console.log("hello")</script>
        </head><body></body></html>`
        const result = stripGtmScripts(html)
        expect(result).toContain("owid.abc123.mjs")
        expect(result).toContain('console.log("hello")')
    })

    it("handles HTML with no script tags", () => {
        const html = `<html><head><title>No scripts</title></head><body>Plain</body></html>`
        const result = stripGtmScripts(html)
        expect(result).toContain("No scripts")
        expect(result).toContain("Plain")
    })

    it("removes multiple GTM-related scripts", () => {
        const html = `<html><head>
            <script>window.dataLayer=window.dataLayer||[];(function(w,d,s,l,i){j.src='https://www.googletagmanager.com/gtm.js?id='+i;})(window,document,'script','dataLayer','GTM-N2D4V8S');</script>
            <script>/* Google Tag Manager */ gtag('config', 'GTM-N2D4V8S');</script>
            <script src="/assets/app.js"></script>
        </head><body></body></html>`
        const result = stripGtmScripts(html)
        expect(result).not.toContain("googletagmanager")
        expect(result).not.toContain("Google Tag Manager")
        expect(result).toContain('<script src="/assets/app.js"></script>')
    })

    it("preserves surrounding HTML byte-for-byte", () => {
        const html = `<html><head><meta name="viewport" content="width=device-width"/><script>googletagmanager</script></head><body><br/></body></html>`
        const result = stripGtmScripts(html)
        expect(result).not.toContain("googletagmanager")
        expect(result).toContain(
            '<meta name="viewport" content="width=device-width"/>'
        )
        expect(result).toContain("<br/>")
    })

    it("does not cross </script> boundaries when non-GTM script precedes GTM script", () => {
        const html = `<html><head>
            <script>console.log("app init")</script>
            <script>/* Google Tag Manager */ loadGTM();</script>
        </head><body></body></html>`
        const result = stripGtmScripts(html)
        expect(result).toContain('console.log("app init")')
        expect(result).not.toContain("Google Tag Manager")
    })

    it("handles GTM script with attributes", () => {
        const html = `<html><head>
            <script type="text/javascript">/* Google Tag Manager */ init();</script>
        </head><body></body></html>`
        const result = stripGtmScripts(html)
        expect(result).not.toContain("Google Tag Manager")
    })

    it("matches the exact GTM output from Head.tsx", () => {
        const html = `<html><head>
            <script>/* Prepare Google Tag Manager */
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag("consent","default",{"ad_storage":"denied","ad_user_data":"denied","ad_personalization":"denied","analytics_storage":"denied","wait_for_update":1000});
</script>
            <script>/* Load Google Tag Manager */
(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-N2D4V8S');</script>
            <script src="/assets/owid.abc123.mjs" type="module"></script>
        </head><body></body></html>`
        const result = stripGtmScripts(html)
        expect(result).not.toContain("Google Tag Manager")
        expect(result).not.toContain("googletagmanager")
        expect(result).toContain("owid.abc123.mjs")
    })
})

describe("rewriteArchiveUrls", () => {
    const archiveUrl = "https://archive.ourworldindata.org"
    const wikipediaUrl = "https://wikipedia-archive.ourworldindata.org"

    it("rewrites archive URL in link tags", () => {
        const html = `<link rel="archives" href="https://archive.ourworldindata.org/20250101-120000/grapher/life-expectancy.html">`
        const result = rewriteArchiveUrls(html, archiveUrl, wikipediaUrl)
        expect(result).toContain(
            "https://wikipedia-archive.ourworldindata.org/20250101-120000/grapher/life-expectancy.html"
        )
        expect(result).not.toContain(archiveUrl)
    })

    it("rewrites archive URL in JSON context", () => {
        const html = `<script>window._OWID_ARCHIVE_CONTEXT={"archiveUrl":"https://archive.ourworldindata.org/20250101-120000/grapher/life-expectancy.html"}</script>`
        const result = rewriteArchiveUrls(html, archiveUrl, wikipediaUrl)
        expect(result).toContain(
            "https://wikipedia-archive.ourworldindata.org/20250101-120000/grapher/life-expectancy.html"
        )
    })

    it("rewrites all occurrences", () => {
        const html = `<div>
            <a href="https://archive.ourworldindata.org/a">Link 1</a>
            <a href="https://archive.ourworldindata.org/b">Link 2</a>
        </div>`
        const result = rewriteArchiveUrls(html, archiveUrl, wikipediaUrl)
        const matches = result.match(/wikipedia-archive/g)
        expect(matches).toHaveLength(2)
        expect(result).not.toContain(archiveUrl)
    })

    it("does nothing when archive URL is not present", () => {
        const html = `<html><body>No archive links here</body></html>`
        const result = rewriteArchiveUrls(html, archiveUrl, wikipediaUrl)
        expect(result).toBe(html)
    })
})
