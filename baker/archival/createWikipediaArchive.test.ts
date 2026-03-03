import { describe, it, expect } from "vitest"
import {
    buildGtmStripRegex,
    isDataPageHtml,
    findPostFiles,
} from "./createWikipediaArchive.js"

describe("isDataPageHtml", () => {
    it("matches grapher HTML under a date dir", () => {
        expect(
            isDataPageHtml("20250414-074331/grapher/life-expectancy.html")
        ).toBe(true)
    })

    it("matches explorer HTML under a date dir", () => {
        expect(isDataPageHtml("20250414-074331/explorers/co2.html")).toBe(true)
    })

    it("matches grapher HTML under the latest dir", () => {
        expect(isDataPageHtml("latest/grapher/life-expectancy.html")).toBe(true)
    })

    it("matches deeply nested grapher paths", () => {
        expect(isDataPageHtml("latest/grapher/some/nested/page.html")).toBe(
            true
        )
    })

    it("rejects post HTML directly under a date dir", () => {
        expect(isDataPageHtml("20250414-074331/poverty.html")).toBe(false)
    })

    it("rejects files at the root level", () => {
        expect(isDataPageHtml("index.html")).toBe(false)
    })

    it("rejects non-grapher/explorer subdirectories", () => {
        expect(isDataPageHtml("20250414-074331/other/page.html")).toBe(false)
    })

    it("rejects non-HTML files under grapher/explorers", () => {
        expect(
            isDataPageHtml(
                "20250414-074331/grapher/life-expectancy.manifest.json"
            )
        ).toBe(false)
    })
})

describe("findPostFiles", () => {
    it("returns both HTML and manifest when pair exists", () => {
        const files = [
            "20250414-074331/poverty.html",
            "20250414-074331/poverty.manifest.json",
            "20250414-074331/grapher/life-expectancy.html",
        ]
        const result = findPostFiles(files)
        expect(result).toEqual(
            new Set([
                "20250414-074331/poverty.html",
                "20250414-074331/poverty.manifest.json",
            ])
        )
    })

    it("ignores HTML without a companion manifest", () => {
        const files = [
            "20250414-074331/orphan.html",
            "20250414-074331/grapher/life-expectancy.html",
        ]
        const result = findPostFiles(files)
        expect(result.size).toBe(0)
    })

    it("ignores manifest without a companion HTML", () => {
        const files = [
            "20250414-074331/orphan.manifest.json",
            "20250414-074331/grapher/life-expectancy.html",
        ]
        const result = findPostFiles(files)
        expect(result.size).toBe(0)
    })

    it("works with the latest directory", () => {
        const files = ["latest/article.html", "latest/article.manifest.json"]
        const result = findPostFiles(files)
        expect(result).toEqual(
            new Set(["latest/article.html", "latest/article.manifest.json"])
        )
    })

    it("ignores grapher/explorer files even if paired", () => {
        const files = [
            "20250414-074331/grapher/co2.html",
            "20250414-074331/grapher/co2.manifest.json",
        ]
        const result = findPostFiles(files)
        expect(result.size).toBe(0)
    })
})

describe("buildGtmStripRegex", () => {
    const regex = buildGtmStripRegex()

    // This mirrors the actual HTML rendered by GTMScriptTags in site/Head.tsx
    const sampleGtmBlock = [
        '<script data-owid-marker="OWID:GTM-BEGIN"></script>',
        "<script>/* Prepare Google Tag Manager */",
        "window.dataLayer = window.dataLayer || [];",
        "function gtag(){dataLayer.push(arguments);}",
        'gtag("consent","default",{"ad_storage":"denied","analytics_storage":"denied"});',
        "</script>",
        "<script>/* Load Google Tag Manager */",
        "(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':",
        "new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],",
        "j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=",
        "'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);",
        "})(window,document,'script','dataLayer','GTM-XXXXX');</script>",
        '<script data-owid-marker="OWID:GTM-END"></script>',
    ].join("\n")

    const surroundingHtml =
        "<head><meta charset='utf-8'>BEFORE" + sampleGtmBlock + "AFTER</head>"

    it("strips the entire GTM block including markers", () => {
        const result = surroundingHtml.replace(regex, "")
        expect(result).toBe("<head><meta charset='utf-8'>BEFOREAFTER</head>")
    })

    it("removes all googletagmanager.com references", () => {
        const result = surroundingHtml.replace(regex, "")
        expect(result).not.toContain("googletagmanager.com")
    })

    it("removes all dataLayer references", () => {
        const result = surroundingHtml.replace(regex, "")
        expect(result).not.toContain("dataLayer")
    })

    it("does not match when markers are absent", () => {
        const htmlWithoutMarkers =
            "<head><script>some other script</script></head>"
        const result = htmlWithoutMarkers.replace(regex, "")
        expect(result).toBe(htmlWithoutMarkers)
    })

    it("handles multiple GTM blocks in one document", () => {
        const doubled = surroundingHtml + surroundingHtml
        const result = doubled.replace(regex, "")
        expect(result).not.toContain("googletagmanager.com")
        expect(result).not.toContain("OWID:GTM")
    })

    it("handles marker tags with extra whitespace", () => {
        const html = [
            '<script  data-owid-marker="OWID:GTM-BEGIN" > </script>',
            "<script>googletagmanager.com</script>",
            '<script  data-owid-marker="OWID:GTM-END" > </script>',
        ].join("\n")
        const result = html.replace(regex, "")
        expect(result).not.toContain("googletagmanager.com")
    })
})
