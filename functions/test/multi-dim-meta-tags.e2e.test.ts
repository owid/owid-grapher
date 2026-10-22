import * as cheerio from "cheerio"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { beforeAll, afterAll, describe, expect, it } from "vitest"
import { unstable_startWorker } from "wrangler"
import { MultiDimPageCompanion } from "@ourworldindata/types"

let worker: Awaited<ReturnType<typeof unstable_startWorker>>

async function workerFetch(pathname: string, init?: unknown) {
    return worker.fetch(`http://example.com${pathname}`, init as never)
}

/**
 * Render an HTML attribute with React so the fixture's attribute escaping
 * exactly matches what the baked pages contain, e.g. `name="a &quot;b&quot;"`.
 */
function renderAttrWithReact(name: string, value: string): string {
    const html = renderToStaticMarkup(createElement("div", { [name]: value }))
    return html.slice("<div ".length, -"></div>".length)
}

const MULTI_DIM_BASE_URL =
    "https://ourworldindata.org/grapher/vaccination-coverage"
const MULTI_DIM_PAGE_TITLE = "Childhood vaccination coverage - by vaccine"
const MULTI_DIM_DEFAULT_DIMENSIONS = { antigen: "dtp3", metric: "coverage" }
const MULTI_DIM_COMPANION: MultiDimPageCompanion = {
    title: MULTI_DIM_PAGE_TITLE,
    views: {
        "antigen=dtp3&metric=coverage": {
            title: "Share of one-year-olds vaccinated against diphtheria, tetanus & pertussis",
        },
        "antigen=hepb_bd&metric=vaccinated": {
            title: "Newborns given a hepatitis B vaccine dose within 24 hours",
        },
    },
}

function makeMultiDimPageHtml({ withMultiDimAttrs = true } = {}): string {
    const headAttrs = withMultiDimAttrs
        ? ` ${renderAttrWithReact(
              "data-owid-mdim-initial-view-dimensions",
              JSON.stringify(MULTI_DIM_DEFAULT_DIMENSIONS)
          )}`
        : ""
    return `<!DOCTYPE html><html><head${headAttrs}>
<link rel="canonical" href="${MULTI_DIM_BASE_URL}"/>
<title>${MULTI_DIM_PAGE_TITLE} | Our World in Data</title>
<meta property="og:title" content="${MULTI_DIM_PAGE_TITLE}"/>
<meta name="twitter:title" content="${MULTI_DIM_PAGE_TITLE}"/>
<meta property="og:url" content="${MULTI_DIM_BASE_URL}"/>
</head><body><svg><title>Download icon</title></svg></body></html>`
}

async function rewriteMetaTagsForUrl(
    html: string,
    urlStr: string,
    // null = no companion file exists for the page
    companion: MultiDimPageCompanion | null = MULTI_DIM_COMPANION
): Promise<string> {
    const response = await workerFetch("/__test__/rewrite-meta-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html, url: urlStr, companion }),
    })
    expect(response.status).toBe(200)
    return response.text()
}

function extractPageBits(html: string) {
    const $ = cheerio.load(html)
    return {
        title: $("head > title").text(),
        ogTitle: $('meta[property="og:title"]').attr("content"),
        twitterTitle: $('meta[name="twitter:title"]').attr("content"),
        canonical: $('link[rel="canonical"]').attr("href"),
        svgTitle: $("body svg title").text(),
    }
}

describe("multi-dim meta tag rewriting", () => {
    beforeAll(async () => {
        worker = await unstable_startWorker({
            config: "./functions/test/wrangler.multi-dim.e2e.jsonc",
            dev: { logLevel: "none" },
        })
    })

    afterAll(async () => {
        await worker.dispose()
    })

    it("serves the view's title when dimension params are present", async () => {
        const html = await rewriteMetaTagsForUrl(
            makeMultiDimPageHtml(),
            // Unsorted dimension params plus a non-dimension param (tab)
            `${MULTI_DIM_BASE_URL}?metric=vaccinated&antigen=hepb_bd&tab=map`
        )
        const viewTitle =
            "Newborns given a hepatitis B vaccine dose within 24 hours"
        const bits = extractPageBits(html)
        expect(bits.title).toBe(
            `${viewTitle} | ${MULTI_DIM_PAGE_TITLE} | Our World in Data`
        )
        expect(bits.ogTitle).toBe(`${viewTitle} | ${MULTI_DIM_PAGE_TITLE}`)
        expect(bits.twitterTitle).toBe(`${viewTitle} | ${MULTI_DIM_PAGE_TITLE}`)
        // Dimension params are sorted and non-dimension params dropped
        expect(bits.canonical).toBe(
            `${MULTI_DIM_BASE_URL}?antigen=hepb_bd&metric=vaccinated`
        )
        // <title> elements of inline SVGs in the body are left alone
        expect(bits.svgTitle).toBe("Download icon")
    })

    it("fills in default choices for missing dimension params and doesn't double-escape entities", async () => {
        const html = await rewriteMetaTagsForUrl(
            makeMultiDimPageHtml(),
            `${MULTI_DIM_BASE_URL}?metric=coverage`
        )
        const viewTitle =
            "Share of one-year-olds vaccinated against diphtheria, tetanus & pertussis"
        const bits = extractPageBits(html)
        expect(bits.title).toBe(
            `${viewTitle} | ${MULTI_DIM_PAGE_TITLE} | Our World in Data`
        )
        expect(bits.ogTitle).toBe(`${viewTitle} | ${MULTI_DIM_PAGE_TITLE}`)
        expect(bits.canonical).toBe(
            `${MULTI_DIM_BASE_URL}?antigen=dtp3&metric=coverage`
        )
        expect(html).not.toContain("&amp;amp;")
    })

    it("resolves to an existing view when the default fill doesn't exist", async () => {
        // metric=vaccinated exists only in combination with antigen=hepb_bd,
        // not with the default antigen (dtp3)
        const html = await rewriteMetaTagsForUrl(
            makeMultiDimPageHtml(),
            `${MULTI_DIM_BASE_URL}?metric=vaccinated`
        )
        const viewTitle =
            "Newborns given a hepatitis B vaccine dose within 24 hours"
        const bits = extractPageBits(html)
        expect(bits.title).toBe(
            `${viewTitle} | ${MULTI_DIM_PAGE_TITLE} | Our World in Data`
        )
        expect(bits.canonical).toBe(
            `${MULTI_DIM_BASE_URL}?antigen=hepb_bd&metric=vaccinated`
        )
    })

    it("keeps the generic title on the bare multi-dim URL but still rewrites the canonical URL", async () => {
        const html = await rewriteMetaTagsForUrl(
            makeMultiDimPageHtml(),
            MULTI_DIM_BASE_URL
        )
        const bits = extractPageBits(html)
        expect(bits.title).toBe(`${MULTI_DIM_PAGE_TITLE} | Our World in Data`)
        expect(bits.ogTitle).toBe(MULTI_DIM_PAGE_TITLE)
        expect(bits.canonical).toBe(
            `${MULTI_DIM_BASE_URL}?antigen=dtp3&metric=coverage`
        )
    })

    it("keeps the generic title for dimension choices that don't match a view and canonicalizes to the default view", async () => {
        const html = await rewriteMetaTagsForUrl(
            makeMultiDimPageHtml(),
            `${MULTI_DIM_BASE_URL}?antigen=nonexistent`
        )
        const bits = extractPageBits(html)
        expect(bits.title).toBe(`${MULTI_DIM_PAGE_TITLE} | Our World in Data`)
        expect(bits.canonical).toBe(
            `${MULTI_DIM_BASE_URL}?antigen=dtp3&metric=coverage`
        )
    })

    it("degrades to the generic title when the companion file can't be loaded", async () => {
        const html = await rewriteMetaTagsForUrl(
            makeMultiDimPageHtml(),
            `${MULTI_DIM_BASE_URL}?antigen=hepb_bd&metric=vaccinated`,
            null
        )
        const bits = extractPageBits(html)
        expect(bits.title).toBe(`${MULTI_DIM_PAGE_TITLE} | Our World in Data`)
        expect(bits.canonical).toBe(
            `${MULTI_DIM_BASE_URL}?antigen=hepb_bd&metric=vaccinated`
        )
    })

    it("leaves titles and canonical URL of non-multi-dim pages untouched", async () => {
        const html = await rewriteMetaTagsForUrl(
            makeMultiDimPageHtml({ withMultiDimAttrs: false }),
            `${MULTI_DIM_BASE_URL}?tab=map`
        )
        const bits = extractPageBits(html)
        expect(bits.title).toBe(`${MULTI_DIM_PAGE_TITLE} | Our World in Data`)
        expect(bits.ogTitle).toBe(MULTI_DIM_PAGE_TITLE)
        expect(bits.canonical).toBe(MULTI_DIM_BASE_URL)
    })
})
