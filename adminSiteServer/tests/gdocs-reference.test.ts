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
    body: OwidEnrichedGdocBlock[]
}): Promise<void> {
    const { id, slug, type, published, body } = options
    // posts_gdocs.type (like posts_gdocs_components.type) is a stored
    // generated column derived from the JSON — only the JSON is inserted.
    await env.testKnex(PostsGdocsTableName).insert({
        id,
        slug,
        content: JSON.stringify({ title: `Title of ${slug}`, type, body }),
        published: published ? 1 : 0,
        publishedAt: published ? new Date("2026-01-01") : null,
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-01"),
    })
    await env
        .testKnex(PostsGdocsComponentsTableName)
        .insert(getGdocComponentsWithoutChildren(id, body))
}

const text = (value: string): OwidEnrichedGdocBlock =>
    ({
        type: "text",
        value: [{ spanType: "span-simple-text", text: value }],
        parseErrors: [],
    }) as OwidEnrichedGdocBlock

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

        const usage = await env.fetchJson("/gdocs-reference/usage.json")
        expect(usage.totalDocsByType).toEqual({ article: 1 })
        const chartUsage = usage.components.find(
            (component: { componentId: string }) =>
                component.componentId === "chart"
        )
        // the draft doc's chart must not count
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

    it("exemplars.json outlines seeded exemplars and reports stale ones", async () => {
        // the article template's sidecar names us-crime-rates and slavery as
        // exemplars; seed only the first so the second reports as stale
        await seedDoc({
            id: "exemplar-doc",
            slug: "us-crime-rates",
            type: "article",
            published: true,
            body: [
                text("intro"),
                heading("First section"),
                text("body"),
                chart("https://example.org/grapher/a"),
            ],
        })

        const json = await env.fetchJson(
            "/gdocs-reference/templates/article/exemplars.json"
        )
        expect(json.staleExemplars).toEqual(["slavery"])
        expect(json.exemplars).toHaveLength(1)
        const [exemplar] = json.exemplars
        expect(exemplar.slug).toBe("us-crime-rates")
        expect(exemplar.sections).toHaveLength(2)
        // intro section has no heading; the second gets heading + anchor
        expect(exemplar.sections[0].heading).toBeUndefined()
        expect(exemplar.sections[0].composition).toEqual({ text: 1 })
        expect(exemplar.sections[1].heading).toBe("First section")
        expect(exemplar.sections[1].anchor).toBe("first-section")
        expect(exemplar.sections[1].composition).toEqual({ text: 1, chart: 1 })
    })

    it("exemplars.json 404s for an unknown template", async () => {
        const res = await rawGet(
            "/gdocs-reference/templates/no-such-template/exemplars.json"
        )
        expect(res.status).toBe(404)
    })
})
