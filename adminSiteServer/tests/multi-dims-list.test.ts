import { describe, it, expect, beforeEach } from "vitest"
import { getAdminTestEnv } from "./testEnv.js"
import {
    AnalyticsGrapherViewsTableName,
    ContentGraphLinkType,
    ImagesTableName,
    MultiDimRedirectsTableName,
    MultiDimXChartConfigsTableName,
    PostsGdocsLinksTableName,
    PostsGdocsTableName,
    StaticVizTableName,
} from "@ourworldindata/types"
import { latestGrapherConfigSchema } from "@ourworldindata/grapher"
import {
    catalogPath,
    multiDimConfig,
    otherVariableId,
    seedDatasetAndVariables,
    variableId,
} from "./fixtures.js"
// The admin's list of multi-dims shows what each one's config says and how it
// is used, counted as the chart list counts a chart's uses. The counts are
// subqueries over several tables, so this checks them on a seeded database,
// with links that must not count alongside those that must.

const env = getAdminTestEnv()

const SLUG = "energy-use"

async function createMultiDim(): Promise<number> {
    const config = {
        ...multiDimConfig([
            {
                dimensions: { metric: "total" },
                indicators: { y: variableId },
            },
            {
                dimensions: { metric: "per_capita" },
                indicators: { y: otherVariableId },
            },
        ]),
        topicTags: ["Energy", "Climate Change"],
    }
    const { id } = await env.request({
        method: "PUT",
        path: `/multi-dims/${encodeURIComponent(catalogPath)}`,
        body: JSON.stringify({ config }),
    })
    await env.request({
        method: "PATCH",
        path: `/multi-dims/${id}`,
        body: JSON.stringify({ published: true, slug: SLUG }),
    })
    return id
}

async function seedNarrativeChartFromAView(): Promise<void> {
    const view = await env.testKnex(MultiDimXChartConfigsTableName).first()
    await env.request({
        method: "POST",
        path: "/narrative-charts",
        body: JSON.stringify({
            type: "multiDim",
            name: "narrative-chart-from-a-view",
            parentChartConfigId: view.chartConfigId,
            config: {
                $schema: latestGrapherConfigSchema,
                title: "Narrative title",
            },
        }),
    })
}

/** A gdoc with one link to `target` */
async function seedGdocLinkingTo({
    id,
    target,
    published = true,
    type = "article",
    linkType = ContentGraphLinkType.Grapher,
}: {
    id: string
    target: string
    published?: boolean
    type?: string
    linkType?: ContentGraphLinkType
}): Promise<void> {
    await env.testKnex(PostsGdocsTableName).insert({
        id,
        slug: id,
        content: JSON.stringify({ title: id, type }),
        published: published ? 1 : 0,
        publishedAt: published ? new Date("2026-01-01") : null,
        createdAt: new Date("2026-01-01"),
    })
    await env.testKnex(PostsGdocsLinksTableName).insert({
        sourceId: id,
        target,
        linkType,
        componentType: "chart",
        text: "",
        queryString: "",
        hash: "",
    })
}

async function seedStaticVizOf(grapherSlug: string): Promise<void> {
    const [imageId] = await env.testKnex(ImagesTableName).insert({
        filename: "static-viz.png",
        originalWidth: 800,
        originalHeight: 600,
        cloudflareId: "static-viz-cloudflare-id",
        hash: "static-viz-hash",
    })
    await env.testKnex(StaticVizTableName).insert({
        name: "static-viz",
        imageId,
        grapherSlug,
    })
}

async function listedMultiDim(id: number): Promise<{ id: number }> {
    const { multiDims } = await env.fetchJson("/multi-dims.json")
    return multiDims.find((mdim: { id: number }) => mdim.id === id)
}

describe("Listing multi-dims", { timeout: 20000 }, () => {
    beforeEach(async () => {
        await seedDatasetAndVariables(env)
    })

    it("reads the dimensions, tags and views from its config", async () => {
        const id = await createMultiDim()

        expect(await listedMultiDim(id)).toMatchObject({
            id,
            catalogPath,
            slug: SLUG,
            title: "Energy use",
            published: true,
            dimensions: ["Metric"],
            tags: ["Energy", "Climate Change"],
            mdimViews: 2,
        })
    })

    it("counts its readers, narrative charts and references", async () => {
        const id = await createMultiDim()
        await env.testKnex(AnalyticsGrapherViewsTableName).insert({
            day: new Date("2026-10-01"),
            grapher_slug: SLUG,
            views_7d: 70,
            views_14d: 140,
            views_365d: 3650,
        })
        await seedNarrativeChartFromAView()
        // Three references: a published article, one linking to an old slug
        // that now redirects here, and a static visualization
        await seedGdocLinkingTo({ id: "published-article", target: SLUG })
        await env.testKnex(MultiDimRedirectsTableName).insert({
            source: "/grapher/old-energy-use",
            multiDimId: id,
        })
        await seedGdocLinkingTo({
            id: "article-with-old-link",
            target: "old-energy-use",
        })
        await seedStaticVizOf(SLUG)
        // None of these count: a draft, a fragment, and an explorer that
        // happens to share the slug
        await seedGdocLinkingTo({
            id: "draft-article",
            target: SLUG,
            published: false,
        })
        await seedGdocLinkingTo({
            id: "a-fragment",
            target: SLUG,
            type: "fragment",
        })
        await seedGdocLinkingTo({
            id: "explorer-link",
            target: SLUG,
            linkType: ContentGraphLinkType.Explorer,
        })

        expect(await listedMultiDim(id)).toMatchObject({
            viewsPerDay: 10,
            narrativeChartsCount: 1,
            referencesCount: 3,
        })
    })

    it("lists a draft without a slug or tags, with nothing counted", async () => {
        const { id } = await env.request({
            method: "PUT",
            path: `/multi-dims/${encodeURIComponent(catalogPath)}`,
            body: JSON.stringify({
                config: multiDimConfig([
                    {
                        dimensions: { metric: "total" },
                        indicators: { y: variableId },
                    },
                ]),
            }),
        })
        expect(await listedMultiDim(id)).toMatchObject({
            slug: null,
            published: false,
            tags: [],
            viewsPerDay: 0,
            narrativeChartsCount: 0,
            referencesCount: 0,
        })
    })
})
