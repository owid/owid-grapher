import { beforeEach, afterEach, describe, expect, it, vi } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { load } from "cheerio"
import { docs_v1 } from "@googleapis/docs"
import { OwidGdocType } from "@ourworldindata/types"
import {
    extractGdocPageData,
    deserializeOwidGdocPageData,
} from "@ourworldindata/utils"
import { latestGrapherConfigSchema } from "@ourworldindata/grapher"
import { getAdminTestEnv } from "./testEnv.js"
import { knexReadWriteTransaction } from "../../db/db.js"
import { GdocPost } from "../../db/model/Gdoc/GdocPost.js"
import { gdocToArchie } from "../../db/model/Gdoc/gdocToArchie.js"
import { archieToEnriched } from "../../db/model/Gdoc/archieToEnriched.js"
import { OwidGdoc } from "../../site/gdocs/OwidGdoc.js"

vi.mock(import("../../baker/GrapherBakingUtils.js"), async (original) => ({
    ...(await original()),
    triggerStaticBuild: vi.fn(async () => undefined),
}))
const env = getAdminTestEnv()
beforeEach(async () => {
    await env.testKnex("images").where({ filename: "fixture.png" }).delete()
})
afterEach(async () => {
    await env.testKnex("images").where({ filename: "fixture.png" }).delete()
})

// One small attachment graph: article -> author, image, standalone chart.
// A second corpus row omits the image to exercise the reader-facing fallback.
const source: docs_v1.Schema$Document = {
    documentId: "pipeline-article",
    revisionId: "revision-1",
    body: {
        content: [
            {
                paragraph: {
                    elements: [
                        {
                            textRun: {
                                content:
                                    "title: Pipeline article\ntype: article\nauthors: Fixture Author\n[+body]\n",
                            },
                        },
                    ],
                },
            },
            {
                paragraph: {
                    paragraphStyle: { namedStyleType: "HEADING_2" },
                    elements: [
                        { textRun: { content: "Evidence and sources\n" } },
                    ],
                },
            },
            {
                paragraph: {
                    elements: [
                        {
                            textRun: {
                                content:
                                    "A result with a source.{ref}A precise source note.{/ref}\n\n{.image}\nfilename: fixture.png\ncaption: Fixture caption\n{}\n\n{.chart}\nurl: https://ourworldindata.org/grapher/pipeline-chart\n{}\n[]\n",
                            },
                        },
                    ],
                },
            },
        ],
    },
}

describe("Authored content to rendered page", () => {
    it.each([
        { name: "resolved image", withImage: true },
        { name: "missing image fallback", withImage: false },
    ])(
        "preserves semantic targets and attachments: $name",
        async ({ withImage }) => {
            await env.testKnex("posts_gdocs").insert({
                id: "pipeline-author",
                slug: "fixture-author",
                published: true,
                content: JSON.stringify({
                    type: OwidGdocType.Author,
                    title: "Fixture Author",
                    body: [],
                    authors: [],
                }),
            })
            if (withImage)
                await env.testKnex("images").insert({
                    filename: "fixture.png",
                    cloudflareId: "fixture-image",
                    hash: "fixture-hash",
                    defaultAlt: "A locally resolved diagram",
                    originalWidth: 800,
                    originalHeight: 400,
                    userId: env.userId,
                })
            await env.request({
                method: "POST",
                path: "/charts",
                body: JSON.stringify({
                    $schema: latestGrapherConfigSchema,
                    title: "Resolved chart title",
                    slug: "pipeline-chart",
                    isPublished: true,
                }),
            })
            const gdoc = new GdocPost("pipeline-article")
            const { text } = await gdocToArchie(source)
            gdoc.content = archieToEnriched(text, gdoc._enrichSubclassContent)
            gdoc.slug = "pipeline-article"
            gdoc.published = true
            gdoc.publishedAt = new Date("2024-01-01T00:00:00Z")
            await knexReadWriteTransaction(async (trx) => {
                await gdoc.loadState(trx)
            })
            const pageData = extractGdocPageData(gdoc.toJSON())
            const serialized = JSON.parse(JSON.stringify(pageData))
            expect(serialized.linkedAuthors).toMatchObject([
                { slug: "fixture-author", name: "Fixture Author" },
            ])
            expect(serialized.linkedCharts["pipeline-chart"]).toMatchObject({
                title: "Resolved chart title",
            })
            const $ = load(
                renderToStaticMarkup(
                    createElement(
                        OwidGdoc,
                        deserializeOwidGdocPageData(serialized)
                    )
                )
            )
            expect($("h2#evidence-and-sources").text()).toBe(
                "Evidence and sources"
            )
            const footnoteLink = $("a.ref").attr("href")
            expect(footnoteLink).toMatch(/^#note-/)
            expect($(footnoteLink).text()).toContain("A precise source note.")
            expect($('a[href="/team/fixture-author"]').text()).toContain(
                "Fixture Author"
            )
            expect($(".GrapherWithFallback img").attr("src")).toContain(
                "/grapher/pipeline-chart"
            )
            if (withImage) {
                expect(
                    serialized.imageMetadata["fixture.png"].cloudflareId
                ).toBe("fixture-image")
                expect(
                    $('img[alt="A locally resolved diagram"]').attr("src")
                ).toContain("fixture-image")
                expect($("figcaption").text()).toContain("Fixture caption")
            } else {
                expect(serialized.imageMetadata).not.toHaveProperty(
                    "fixture.png"
                )
                expect($("figcaption").text()).toContain("Fixture caption")
                expect($('img[alt="A locally resolved diagram"]')).toHaveLength(
                    0
                )
            }
        }
    )
})
