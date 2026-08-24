import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { beforeAll, afterAll, describe, expect, it } from "vitest"
import { unstable_startWorker } from "wrangler"
import { MultiDimPageCompanion } from "@ourworldindata/types"
import { decodeReactEscapedAttribute } from "../_common/grapherTools.js"

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

const MDIM_BASE_URL = "https://ourworldindata.org/grapher/vaccination-coverage"
const MDIM_PAGE_TITLE = "Childhood vaccination coverage - by vaccine"
const MDIM_DEFAULT_DIMENSIONS = { antigen: "dtp3", metric: "coverage" }
const MDIM_COMPANION: MultiDimPageCompanion = {
    title: MDIM_PAGE_TITLE,
    views: {
        "antigen=dtp3&metric=coverage": {
            title: "Share of one-year-olds vaccinated against diphtheria, tetanus & pertussis",
        },
        "antigen=hepb_bd&metric=vaccinated": {
            title: "Newborns given a hepatitis B vaccine dose within 24 hours",
        },
    },
}

function makeMdimPageHtml({ withMdimAttrs = true } = {}): string {
    const headAttrs = withMdimAttrs
        ? ` ${renderAttrWithReact(
              "data-owid-mdim-initial-view-dimensions",
              JSON.stringify(MDIM_DEFAULT_DIMENSIONS)
          )}`
        : ""
    const jsonLd = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: MDIM_PAGE_TITLE,
        url: MDIM_BASE_URL,
    })
    return `<!DOCTYPE html><html><head${headAttrs}>
<link rel="canonical" href="${MDIM_BASE_URL}"/>
<title>${MDIM_PAGE_TITLE} | Our World in Data</title>
<meta property="og:title" content="${MDIM_PAGE_TITLE}"/>
<meta name="twitter:title" content="${MDIM_PAGE_TITLE}"/>
<meta property="og:url" content="${MDIM_BASE_URL}"/>
<script type="application/ld+json">${jsonLd}</script>
</head><body><svg><title>Download icon</title></svg></body></html>`
}

async function rewriteMetaTagsForUrl(
    html: string,
    urlStr: string,
    // null = no companion file exists for the page
    companion: MultiDimPageCompanion | null = MDIM_COMPANION
): Promise<string> {
    const response = await workerFetch("/__test__/rewrite-meta-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html, url: urlStr, companion }),
    })
    expect(response.status).toBe(200)
    return response.text()
}

function extractFirstGroup(html: string, regex: RegExp): string {
    const match = html.match(regex)
    expect(match, `expected to match ${regex}`).toBeTruthy()
    return match![1]
}

function extractPageBits(html: string) {
    return {
        title: decodeReactEscapedAttribute(
            extractFirstGroup(html, /<title>(.*?)<\/title>/)
        ),
        ogTitle: decodeReactEscapedAttribute(
            extractFirstGroup(html, /<meta property="og:title" content="(.*?)"/)
        ),
        twitterTitle: decodeReactEscapedAttribute(
            extractFirstGroup(
                html,
                /<meta name="twitter:title" content="(.*?)"/
            )
        ),
        canonical: decodeReactEscapedAttribute(
            extractFirstGroup(html, /<link rel="canonical" href="(.*?)"/)
        ),
        jsonLd: JSON.parse(
            extractFirstGroup(
                html,
                /<script type="application\/ld\+json">(.*?)<\/script>/
            )
        ) as { name?: string; url?: string },
    }
}

describe("multi-dim meta tag rewriting", () => {
    beforeAll(async () => {
        worker = await unstable_startWorker({
            config: "./functions/test/wrangler.e2e.jsonc",
            dev: { logLevel: "none" },
        })
    })

    afterAll(async () => {
        await worker.dispose()
    })

    it("serves the view's title when dimension params are present", async () => {
        const html = await rewriteMetaTagsForUrl(
            makeMdimPageHtml(),
            // Unsorted dimension params plus a non-dimension param (tab)
            `${MDIM_BASE_URL}?metric=vaccinated&antigen=hepb_bd&tab=map`
        )
        const viewTitle =
            "Newborns given a hepatitis B vaccine dose within 24 hours"
        const bits = extractPageBits(html)
        expect(bits.title).toBe(
            `${viewTitle} | ${MDIM_PAGE_TITLE} | Our World in Data`
        )
        expect(bits.ogTitle).toBe(`${viewTitle} | ${MDIM_PAGE_TITLE}`)
        expect(bits.twitterTitle).toBe(`${viewTitle} | ${MDIM_PAGE_TITLE}`)
        // Dimension params are sorted and non-dimension params dropped
        expect(bits.canonical).toBe(
            `${MDIM_BASE_URL}?antigen=hepb_bd&metric=vaccinated`
        )
        expect(bits.jsonLd.name).toBe(`${viewTitle} | ${MDIM_PAGE_TITLE}`)
        expect(bits.jsonLd.url).toBe(
            `${MDIM_BASE_URL}?antigen=hepb_bd&metric=vaccinated`
        )
        // <title> elements of inline SVGs in the body are left alone
        expect(html).toContain("<svg><title>Download icon</title></svg>")
    })

    it("fills in default choices for missing dimension params and doesn't double-escape entities", async () => {
        const html = await rewriteMetaTagsForUrl(
            makeMdimPageHtml(),
            `${MDIM_BASE_URL}?metric=coverage`
        )
        const viewTitle =
            "Share of one-year-olds vaccinated against diphtheria, tetanus & pertussis"
        const bits = extractPageBits(html)
        expect(bits.title).toBe(
            `${viewTitle} | ${MDIM_PAGE_TITLE} | Our World in Data`
        )
        expect(bits.ogTitle).toBe(`${viewTitle} | ${MDIM_PAGE_TITLE}`)
        expect(bits.canonical).toBe(
            `${MDIM_BASE_URL}?antigen=dtp3&metric=coverage`
        )
        expect(html).not.toContain("&amp;amp;")
    })

    it("keeps the generic title on the bare mdim URL but still rewrites the canonical URL", async () => {
        const html = await rewriteMetaTagsForUrl(
            makeMdimPageHtml(),
            MDIM_BASE_URL
        )
        const bits = extractPageBits(html)
        expect(bits.title).toBe(`${MDIM_PAGE_TITLE} | Our World in Data`)
        expect(bits.ogTitle).toBe(MDIM_PAGE_TITLE)
        expect(bits.canonical).toBe(
            `${MDIM_BASE_URL}?antigen=dtp3&metric=coverage`
        )
        expect(bits.jsonLd.name).toBe(MDIM_PAGE_TITLE)
        expect(bits.jsonLd.url).toBe(
            `${MDIM_BASE_URL}?antigen=dtp3&metric=coverage`
        )
    })

    it("keeps the generic title for dimension choices that don't match a view and canonicalizes to the default view", async () => {
        const html = await rewriteMetaTagsForUrl(
            makeMdimPageHtml(),
            `${MDIM_BASE_URL}?antigen=nonexistent`
        )
        const bits = extractPageBits(html)
        expect(bits.title).toBe(`${MDIM_PAGE_TITLE} | Our World in Data`)
        expect(bits.canonical).toBe(
            `${MDIM_BASE_URL}?antigen=dtp3&metric=coverage`
        )
    })

    it("keeps the generic title when the companion file is missing", async () => {
        const html = await rewriteMetaTagsForUrl(
            makeMdimPageHtml(),
            `${MDIM_BASE_URL}?antigen=hepb_bd&metric=vaccinated`,
            null
        )
        const bits = extractPageBits(html)
        expect(bits.title).toBe(`${MDIM_PAGE_TITLE} | Our World in Data`)
        expect(bits.canonical).toBe(
            `${MDIM_BASE_URL}?antigen=hepb_bd&metric=vaccinated`
        )
    })

    it("leaves titles and canonical URL of non-mdim pages untouched", async () => {
        const html = await rewriteMetaTagsForUrl(
            makeMdimPageHtml({ withMdimAttrs: false }),
            `${MDIM_BASE_URL}?tab=map`
        )
        const bits = extractPageBits(html)
        expect(bits.title).toBe(`${MDIM_PAGE_TITLE} | Our World in Data`)
        expect(bits.ogTitle).toBe(MDIM_PAGE_TITLE)
        expect(bits.canonical).toBe(MDIM_BASE_URL)
        expect(bits.jsonLd.name).toBe(MDIM_PAGE_TITLE)
        expect(bits.jsonLd.url).toBe(MDIM_BASE_URL)
    })
})

describe("full /grapher/[slug] request flow with a companion file", () => {
    const slug = "vaccination-coverage"

    beforeAll(async () => {
        worker = await unstable_startWorker({
            config: "./functions/test/wrangler.e2e.jsonc",
            dev: { logLevel: "none" },
        })
        await workerFetch("/__test__/seed-asset", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                pathname: `/grapher/${slug}`,
                body: makeMdimPageHtml(),
                contentType: "text/html",
            }),
        })
        await workerFetch("/__test__/seed-asset", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                pathname: `/grapher/${slug}.mdim.json`,
                body: JSON.stringify(MDIM_COMPANION),
                contentType: "application/json",
            }),
        })
    })

    afterAll(async () => {
        await workerFetch("/__test__/clear-assets", { method: "POST" })
        await worker.dispose()
    })

    it("serves the view title from the companion file", async () => {
        const response = await workerFetch(
            `/grapher/${slug}?metric=vaccinated&antigen=hepb_bd`
        )
        expect(response.status).toBe(200)
        const html = await response.text()
        const bits = extractPageBits(html)
        const viewTitle =
            "Newborns given a hepatitis B vaccine dose within 24 hours"
        expect(bits.title).toBe(
            `${viewTitle} | ${MDIM_PAGE_TITLE} | Our World in Data`
        )
        expect(bits.ogTitle).toBe(`${viewTitle} | ${MDIM_PAGE_TITLE}`)
    })

    it("serves the generic title on the bare mdim URL", async () => {
        const response = await workerFetch(`/grapher/${slug}`)
        expect(response.status).toBe(200)
        const html = await response.text()
        const bits = extractPageBits(html)
        expect(bits.title).toBe(`${MDIM_PAGE_TITLE} | Our World in Data`)
        expect(bits.canonical).toBe(
            `${MDIM_BASE_URL}?antigen=dtp3&metric=coverage`
        )
    })

    it("serves the companion file itself as JSON", async () => {
        const response = await workerFetch(`/grapher/${slug}.mdim.json`)
        expect(response.status).toBe(200)
        expect(response.headers.get("Content-Type")).toBe("application/json")
        const companion = (await response.json()) as MultiDimPageCompanion
        expect(companion).toEqual(MDIM_COMPANION)
    })
})
