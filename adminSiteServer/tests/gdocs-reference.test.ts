import { describe, it, expect } from "vitest"
import {
    OwidEnrichedGdocBlock,
    PostsGdocsComponentsTableName,
    PostsGdocsTableName,
} from "@ourworldindata/types"
import { getGdocComponentsWithoutChildren } from "../../db/model/Gdoc/extractGdocComponentInfo.js"
import { getAdminTestEnv } from "./testEnv.js"

const env = getAdminTestEnv()

async function rawGet(path: string): Promise<Response> {
    return await fetch(env.baseUrl + path, {
        headers: { Authorization: `Bearer ${env.apiKey}` },
    })
}

// Seed a published (or not) gdoc and its posts_gdocs_components rows,
// derived through the same extraction the production save path uses
// (children omitted, spans flattened).
async function seedDoc(options: {
    id: string
    slug: string
    type: string
    published: boolean
    /** Overrides the default past date — a future date makes a scheduled doc */
    publishedAt?: Date
    body: OwidEnrichedGdocBlock[]
    /** Profile-only: the entity scope, e.g. "China, Japan" */
    scope?: string
}): Promise<void> {
    const { id, slug, type, published, publishedAt, body, scope } = options
    // posts_gdocs.type (like posts_gdocs_components.type) is a stored
    // generated column derived from the JSON — only the JSON is inserted.
    await env.testKnex(PostsGdocsTableName).insert({
        id,
        slug,
        content: JSON.stringify({
            title: `Title of ${slug}`,
            type,
            body,
            ...(scope !== undefined && { scope }),
        }),
        published: published ? 1 : 0,
        publishedAt: published ? (publishedAt ?? new Date("2026-01-01")) : null,
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-01"),
    })
    await env
        .testKnex(PostsGdocsComponentsTableName)
        .insert(getGdocComponentsWithoutChildren(id, body))
}

const text = (value: string): OwidEnrichedGdocBlock => ({
    type: "text",
    value: [{ spanType: "span-simple-text", text: value }],
    parseErrors: [],
})

const chart = (url: string, size?: string): OwidEnrichedGdocBlock =>
    ({
        type: "chart",
        url,
        ...(size && { size }),
        parseErrors: [],
    }) as unknown as OwidEnrichedGdocBlock

const heading = (value: string, level = 1): OwidEnrichedGdocBlock =>
    ({
        type: "heading",
        text: [{ spanType: "span-simple-text", text: value }],
        level,
        parseErrors: [],
    }) as unknown as OwidEnrichedGdocBlock

const topicPageIntro = (downloadButton?: {
    text: string
    url: string
}): OwidEnrichedGdocBlock =>
    ({
        type: "topic-page-intro",
        ...(downloadButton && {
            downloadButton: {
                ...downloadButton,
                type: "topic-page-intro-download-button",
            },
        }),
        relatedTopics: [],
        content: [text("Intro paragraph.")],
        parseErrors: [],
    }) as unknown as OwidEnrichedGdocBlock

describe("writing reference live API", { timeout: 20000 }, () => {
    it("usage.json aggregates published docs only, with labels", async () => {
        await seedDoc({
            id: "usage-published",
            slug: "usage-published",
            type: "article",
            published: true,
            body: [text("hello"), chart("https://example.org/grapher/a")],
        })
        await seedDoc({
            id: "usage-draft",
            slug: "usage-draft",
            type: "article",
            published: false,
            body: [chart("https://example.org/grapher/b")],
        })
        // published = 1 but not yet live: scheduled docs count as drafts
        await seedDoc({
            id: "usage-scheduled",
            slug: "usage-scheduled",
            type: "article",
            published: true,
            publishedAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            body: [chart("https://example.org/grapher/c")],
        })

        const usage = await env.fetchJson("/gdocs-reference/usage.json")
        expect(usage.totalDocsByType).toEqual({ article: 1 })
        const chartUsage = usage.components.find(
            (component: { componentId: string }) =>
                component.componentId === "chart"
        )
        // neither the draft nor the scheduled doc's chart may count
        expect(chartUsage.docsUsingIt).toBe(1)
        expect(chartUsage.totalUses).toBe(1)
        expect(chartUsage.byDocType).toEqual([
            {
                docType: "article",
                docsUsingIt: 1,
                totalDocs: 1,
                totalUses: 1,
                label: "standard",
            },
        ])
    })

    it("instances.json returns real instances with archie, variations and anchors", async () => {
        await seedDoc({
            id: "instances-doc",
            // the registry pins the chart component to this slug, so the
            // seeded doc also exercises pinned-example resolution
            slug: "us-crime-rates",
            type: "article",
            published: true,
            body: [
                heading("A section"),
                // Vintage fixture: the same authoring is stored with or
                // without injected defaults depending on when its doc was
                // last saved — a bare chart and an explicit size:wide chart
                // MUST land in the same variation, or the analysis depends
                // on parser vintage. Two narrow charts, so the size value
                // repeats and is detected as an enum-like choice.
                chart("https://example.org/grapher/a"),
                chart("https://example.org/grapher/b", "wide"),
                chart("https://example.org/grapher/c", "narrow"),
                chart("https://example.org/grapher/d", "narrow"),
            ],
        })

        const json = await env.fetchJson(
            "/gdocs-reference/components/chart/instances.json"
        )
        expect(json.total).toBe(4)
        expect(json.instances).toHaveLength(4)
        for (const instance of json.instances) {
            expect(instance.slug).toBe("us-crime-rates")
            expect(instance.archie).toContain("{.chart}")
            // all charts sit under the seeded heading
            expect(instance.anchor).toBe("a-section")
        }
        // bare and explicit-wide collapse into the standard form; narrow is
        // the deviation, split by value because size values repeat across
        // instances (an observed enum). url never shows: it is on every
        // instance, so it is what the component is, not a variation.
        const bySignature = new Map<string, number>(
            json.variations.map(
                (variation: { signature: string; count: number }) => [
                    variation.signature,
                    variation.count,
                ]
            )
        )
        expect(bySignature.get("")).toBe(2)
        expect(bySignature.get("size:narrow")).toBe(2)
        expect([...bySignature.keys()].join("+")).not.toContain("url")
        // the displayed source is minimal: injected defaults never show as
        // typed characters, deviations always do
        const archieOf = (url: string): string =>
            json.instances.find((instance: { archie: string }) =>
                instance.archie.includes(url)
            )?.archie ?? ""
        expect(archieOf("grapher/b")).not.toContain("size")
        expect(archieOf("grapher/c")).toContain("size: narrow")
        // the sidecar pin on us-crime-rates resolves against the seeded doc
        expect(json.stalePins).toEqual([])
        expect(json.pinned).toHaveLength(1)
        expect(json.pinned[0].path).toBe("$.body[1]")
        // per-prop adoption over the scan: url survives minimization on all
        // four charts (required scaffolding), size only where it deviates
        // from the parser default (the two narrow charts)
        expect(json.scanned).toBe(4)
        expect(json.propAdoption.url).toBe(4)
        expect(json.propAdoption.size).toBe(2)
        // the default the parser fills in for an omitted size, read off the
        // stored config of the instance that typed it explicitly and had it
        // stripped again as parse-invariant
        expect(json.propDefaults.size).toBe("wide")
        // url survives minimization everywhere, so it is never "omitted" and
        // never yields a default
        expect(json.propDefaults.url).toBeUndefined()

        // Sidecar examples are matched against the observed forms through the
        // same flattening the extraction applies, so "not used in any
        // published doc yet" means it. The registry's bare chart example is
        // the seeded standard form, so it reads as observed.
        const synthetic = json.syntheticExamples
        const bare = synthetic.find(
            (example: { exampleIndex: number }) => example.exampleIndex === 0
        )
        expect(bare.signature).toBe("")
        expect(bare.observed).toBe(true)
    })

    it("instances.json filters by variation and doc type, and pages", async () => {
        await seedDoc({
            id: "filter-article",
            slug: "filter-article",
            type: "article",
            published: true,
            body: [
                chart("https://example.org/grapher/a"),
                chart("https://example.org/grapher/c", "narrow"),
                chart("https://example.org/grapher/d", "narrow"),
            ],
        })
        await seedDoc({
            id: "filter-topic",
            slug: "filter-topic",
            type: "topic-page",
            published: true,
            body: [chart("https://example.org/grapher/e")],
        })

        const all = await env.fetchJson(
            "/gdocs-reference/components/chart/instances.json"
        )
        expect(all.total).toBe(4)

        // ?variation selects one observed form, not all of them
        const narrow = await env.fetchJson(
            "/gdocs-reference/components/chart/instances.json?variation=size%3Anarrow"
        )
        expect(narrow.total).toBe(2)
        expect(narrow.instances).toHaveLength(2)
        for (const instance of narrow.instances)
            expect(instance.variation).toBe("size:narrow")

        // ?docType excludes instances from documents of another type
        const articles = await env.fetchJson(
            "/gdocs-reference/components/chart/instances.json?docType=article"
        )
        expect(articles.total).toBe(3)
        for (const instance of articles.instances)
            expect(instance.docType).toBe("article")

        // ?page applies an offset rather than repeating page 0
        const secondPage = await env.fetchJson(
            "/gdocs-reference/components/chart/instances.json?page=1"
        )
        expect(secondPage.total).toBe(4)
        expect(secondPage.instances).toHaveLength(0)

        // a malformed page falls back to the first page instead of 500ing or
        // silently reporting no matches
        const badPage = await env.fetchJson(
            "/gdocs-reference/components/chart/instances.json?page=abc"
        )
        expect(badPage.instances).toHaveLength(4)
    })

    it("instances.json distinguishes forms whose raw keys differ from enriched keys", async () => {
        // The stored config carries enriched key names (downloadButton), but
        // signatures are computed in raw space (download-button) — a rename
        // the conversion must apply, or the prop is mistaken for a parser
        // default and stripped, collapsing the form into the standard one.
        await seedDoc({
            id: "tpi-plain",
            slug: "tpi-plain",
            type: "topic-page",
            published: true,
            body: [topicPageIntro()],
        })
        await seedDoc({
            id: "tpi-download",
            slug: "tpi-download",
            type: "topic-page",
            published: true,
            body: [
                topicPageIntro({
                    text: "Download the complete dataset",
                    url: "https://example.org/data.csv",
                }),
            ],
        })

        const json = await env.fetchJson(
            "/gdocs-reference/components/topic-page-intro/instances.json"
        )
        const signatures = json.variations.map(
            (variation: { signature: string }) => variation.signature
        )
        expect(signatures).toContain("")
        expect(signatures).toContain("download-button")
        expect(json.propAdoption["download-button"]).toBe(1)
    })

    it("instances.json 404s for an unknown component", async () => {
        const res = await rawGet(
            "/gdocs-reference/components/no-such-component/instances.json"
        )
        expect(res.status).toBe(404)
    })

    it("exemplars.json resolves seeded exemplars and reports stale ones", async () => {
        // the article template's sidecar names us-crime-rates and slavery as
        // exemplars; seed only the first so the second reports as stale
        await seedDoc({
            id: "exemplar-doc",
            slug: "us-crime-rates",
            type: "article",
            published: true,
            body: [text("intro"), heading("First section"), text("body")],
        })

        const json = await env.fetchJson(
            "/gdocs-reference/templates/article/exemplars.json"
        )
        expect(json.staleExemplars).toEqual(["slavery"])
        expect(json.exemplars).toHaveLength(1)
        const [exemplar] = json.exemplars
        expect(exemplar.gdocId).toBe("exemplar-doc")
        expect(exemplar.slug).toBe("us-crime-rates")
        expect(exemplar.docType).toBe("article")
    })

    it("exemplars.json sets entitySlug for a profile from its scope", async () => {
        // the profile template's sidecar names co2 as its exemplar
        await seedDoc({
            id: "exemplar-profile",
            slug: "co2",
            type: "profile",
            published: true,
            scope: "China, Japan",
            body: [text("intro")],
        })

        const json = await env.fetchJson(
            "/gdocs-reference/templates/profile/exemplars.json"
        )
        expect(json.exemplars).toHaveLength(1)
        const [exemplar] = json.exemplars
        expect(exemplar.slug).toBe("co2")
        expect(exemplar.entitySlug).toBe("china")
    })

    it("exemplars.json 404s for an unknown template", async () => {
        const res = await rawGet(
            "/gdocs-reference/templates/no-such-template/exemplars.json"
        )
        expect(res.status).toBe(404)
    })
})
