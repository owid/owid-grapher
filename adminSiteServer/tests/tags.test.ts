import { describe, it, expect, beforeEach } from "vitest"
import { getAdminTestEnv } from "./testEnv.js"
import {
    DbInsertTag,
    DbInsertTagGraphNode,
    DbInsertPostGdoc,
    DbInsertPostGdocXTag,
    TagsTableName,
    TagGraphTableName,
    PostsGdocsTableName,
    PostsGdocsXTagsTableName,
    TagGraphRootName,
    OwidGdocType,
} from "@ourworldindata/types"
import {
    knexReadonlyTransaction,
    getTagHierarchiesByChildName,
    getTopicHierarchiesByChildName,
    getBestBreadcrumbs,
    TransactionCloseMode,
} from "../../db/db.js"

const env = getAdminTestEnv()

describe("Tag graph and breadcrumbs", { timeout: 15000 }, () => {
    // prettier-ignore
    const dummyTags: DbInsertTag[] = [
        { name: TagGraphRootName, id: 1  },
        { name: "Energy and Environment", id: 2  },
        { name: "Climate & Air", id: 6 },
        { name: "Energy", slug: "energy", id: 3 },
        { name: "Nuclear Energy", slug: "nuclear-energy", id: 4 },
        { name: "CO2 & Greenhouse Gas Emissions", slug: "co2-and-greenhouse-gas-emissions", id: 5 },
    ]

    const dummyTagGraph: DbInsertTagGraphNode[] = [
        { parentId: 1, childId: 2 },
        { parentId: 2, childId: 6 },
        { parentId: 2, childId: 3, weight: 110 },
        { parentId: 6, childId: 5 },
        { parentId: 3, childId: 4 },
        { parentId: 5, childId: 4 },
    ]

    function makeDummyTopicPage(slug: string): DbInsertPostGdoc {
        return {
            slug,
            content: JSON.stringify({
                type: OwidGdocType.TopicPage,
                authors: [] as string[],
            }),
            id: slug,
            published: 1,
            publishedAt: new Date(),
            markdown: "",
        }
    }

    const dummyTopicPages: DbInsertPostGdoc[] = [
        makeDummyTopicPage("energy"),
        makeDummyTopicPage("nuclear-energy"),
        makeDummyTopicPage("co2-and-greenhouse-gas-emissions"),
    ]

    const dummyPostTags: DbInsertPostGdocXTag[] = [
        { gdocId: "energy", tagId: 3 },
        { gdocId: "nuclear-energy", tagId: 4 },
        { gdocId: "co2-and-greenhouse-gas-emissions", tagId: 5 },
    ]

    beforeEach(async () => {
        await env.testKnex!(TagsTableName).insert(dummyTags)
        await env.testKnex!(TagGraphTableName).insert(dummyTagGraph)
        await env.testKnex!(PostsGdocsTableName).insert(dummyTopicPages)
        await env.testKnex!(PostsGdocsXTagsTableName).insert(dummyPostTags)
    })

    it("should be able to see all the tags", async () => {
        const tags = await env.fetchJson("/tags.json")
        expect(tags).toEqual({
            tags: [
                {
                    id: 6,
                    isTopic: 0,
                    name: "Climate & Air",
                    slug: null,
                },
                {
                    id: 5,
                    isTopic: 1,
                    name: "CO2 & Greenhouse Gas Emissions",
                    slug: "co2-and-greenhouse-gas-emissions",
                },
                {
                    id: 3,
                    isTopic: 1,
                    name: "Energy",
                    slug: "energy",
                },
                {
                    id: 2,
                    isTopic: 0,
                    name: "Energy and Environment",
                    slug: null,
                },
                {
                    id: 4,
                    isTopic: 1,
                    name: "Nuclear Energy",
                    slug: "nuclear-energy",
                },
                {
                    id: 1,
                    isTopic: 0,
                    name: "tag-graph-root",
                    slug: null,
                },
            ],
        })
    })

    it("should be able to generate parent tag arrays with sub-areas", async () => {
        await knexReadonlyTransaction(
            async (trx) => {
                const tagHierarchiesByChildName =
                    await getTagHierarchiesByChildName(trx)

                expect(
                    tagHierarchiesByChildName["CO2 & Greenhouse Gas Emissions"]
                ).toEqual([
                    [
                        {
                            id: 2,
                            name: "Energy and Environment",
                            slug: null,
                        },
                        {
                            id: 6,
                            name: "Climate & Air",
                            slug: null,
                        },
                        {
                            id: 5,
                            name: "CO2 & Greenhouse Gas Emissions",
                            slug: "co2-and-greenhouse-gas-emissions",
                        },
                    ],
                ])
            },
            TransactionCloseMode.KeepOpen,
            env.testKnex
        )
    })

    it("should be able to generate parent tag arrays without sub-areas", async () => {
        await knexReadonlyTransaction(
            async (trx) => {
                const topicHierarchiesByChildName =
                    await getTopicHierarchiesByChildName(trx)

                expect(
                    topicHierarchiesByChildName[
                        "CO2 & Greenhouse Gas Emissions"
                    ]
                ).toEqual([
                    [
                        {
                            id: 2,
                            name: "Energy and Environment",
                            slug: null,
                        },
                        {
                            id: 5,
                            name: "CO2 & Greenhouse Gas Emissions",
                            slug: "co2-and-greenhouse-gas-emissions",
                        },
                    ],
                ])
            },
            TransactionCloseMode.KeepOpen,
            env.testKnex
        )
    })

    it("should be able to generate a tag graph", async () => {
        const json = await env.fetchJson("/flatTagGraph.json")
        expect(json).toEqual({
            "1": [
                {
                    childId: 2,
                    isTopic: 0,
                    name: "Energy and Environment",
                    slug: null,
                    parentId: 1,
                    weight: 100,
                },
            ],
            "2": [
                {
                    childId: 3,
                    isTopic: 1,
                    name: "Energy",
                    slug: "energy",
                    parentId: 2,
                    weight: 110,
                },
                {
                    childId: 6,
                    isTopic: 0,
                    name: "Climate & Air",
                    slug: null,
                    parentId: 2,
                    weight: 100,
                },
            ],
            "3": [
                {
                    childId: 4,
                    isTopic: 1,
                    name: "Nuclear Energy",
                    slug: "nuclear-energy",
                    parentId: 3,
                    weight: 100,
                },
            ],
            "5": [
                {
                    childId: 4,
                    isTopic: 1,
                    name: "Nuclear Energy",
                    slug: "nuclear-energy",
                    parentId: 5,
                    weight: 100,
                },
            ],
            "6": [
                {
                    childId: 5,
                    isTopic: 1,
                    name: "CO2 & Greenhouse Gas Emissions",
                    parentId: 6,
                    slug: "co2-and-greenhouse-gas-emissions",
                    weight: 100,
                },
            ],
            __rootId: 1,
        })
    })

    it("should be able to generate a set of breadcrumbs for a tag", async () => {
        await knexReadonlyTransaction(
            async (trx) => {
                const tagHierarchiesByChildName =
                    await getTagHierarchiesByChildName(trx)
                const breadcrumbs = getBestBreadcrumbs(
                    [
                        {
                            id: 4,
                            name: "Nuclear Energy",
                            slug: "nuclear-energy",
                        },
                    ],
                    tagHierarchiesByChildName
                )
                // breadcrumb hrefs are env-dependent, so we just assert on the labels
                const labelsOnly = breadcrumbs.map((b) => b.label)
                expect(labelsOnly).toEqual(["Energy", "Nuclear Energy"])
            },
            TransactionCloseMode.KeepOpen,
            env.testKnex
        )
    })

    it("should generate an optimal set of breadcrumbs when given multiple tags", async () => {
        await knexReadonlyTransaction(
            async (trx) => {
                const tagHierarchiesByChildName =
                    await getTagHierarchiesByChildName(trx)
                const breadcrumbs = getBestBreadcrumbs(
                    [
                        {
                            id: 4,
                            name: "Nuclear Energy",
                            slug: "nuclear-energy",
                        },
                        {
                            id: 5,
                            name: "CO2 & Greenhouse Gas Emissions",
                            slug: "co2-and-greenhouse-gas-emissions",
                        },
                    ],
                    tagHierarchiesByChildName
                )
                // breadcrumb hrefs are env-dependent, so we just assert on the labels
                const labelsOnly = breadcrumbs.map((b) => b.label)
                expect(labelsOnly).toEqual(["Energy", "Nuclear Energy"])
            },
            TransactionCloseMode.KeepOpen,
            env.testKnex
        )
    })

    it("should return an empty array when there are no topic tags in any of the tags' ancestors", async () => {
        await knexReadonlyTransaction(
            async (trx) => {
                const tagHierarchiesByChildName =
                    await getTagHierarchiesByChildName(trx)
                const breadcrumbs = getBestBreadcrumbs(
                    [
                        {
                            id: 2,
                            name: "Energy and Environment",
                            slug: "",
                        },
                    ],
                    tagHierarchiesByChildName
                )
                // breadcrumb hrefs are env-dependent, so we just assert on the labels
                const labelsOnly = breadcrumbs.map((b) => b.label)
                expect(labelsOnly).toEqual([])
            },
            TransactionCloseMode.KeepOpen,
            env.testKnex
        )
    })

    it("when there are two valid paths to a given tag, it selects the longest one", async () => {
        await knexReadonlyTransaction(
            async (trx) => {
                // Here, Women's Employment has 2 paths:
                // 1. Poverty and Economic Development > Women's Employment
                // 2. Human Rights > Women's Rights > Women's Employment
                // prettier-ignore
                await env.testKnex!(TagsTableName).insert([
                    { name: "Human Rights", id: 7 },
                    { name: "Women's Rights", slug: "womens-rights", id: 8 },
                    { name: "Women's Employment", slug: "womens-employment", id: 9 },
                    { name: "Poverty and Economic Development", id: 10 },
                ])
                await env.testKnex!(TagGraphTableName).insert([
                    { parentId: 1, childId: 7 },
                    { parentId: 7, childId: 8 },
                    { parentId: 8, childId: 9 },
                    { parentId: 1, childId: 10 },
                    { parentId: 10, childId: 9 },
                ])
                await env.testKnex!(PostsGdocsTableName).insert([
                    makeDummyTopicPage("womens-rights"),
                    makeDummyTopicPage("womens-employment"),
                ])
                await env.testKnex!(PostsGdocsXTagsTableName).insert([
                    { gdocId: "womens-rights", tagId: 8 },
                    { gdocId: "womens-employment", tagId: 9 },
                ])

                const tagHierarchiesByChildName =
                    await getTagHierarchiesByChildName(trx)
                const breadcrumbs = getBestBreadcrumbs(
                    [
                        {
                            id: 9,
                            name: "Women's Employment",
                            slug: "womens-employment",
                        },
                    ],
                    tagHierarchiesByChildName
                )
                // breadcrumb hrefs are env-dependent, so we just assert on the labels
                const labelsOnly = breadcrumbs.map((b) => b.label)
                expect(labelsOnly).toEqual([
                    "Women's Rights",
                    "Women's Employment",
                ])
            },
            TransactionCloseMode.KeepOpen,
            env.testKnex
        )
    })
})
