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

    it("serves tags API", async () => {
        const tags = await env.fetchJson("/tags.json")
        expect(tags.tags.length).toBeGreaterThan(0)
    })

    it("computes topic breadcrumbs with sub-areas", async () => {
        await knexReadonlyTransaction(
            async (trx) => {
                const topicHierarchiesByChildName =
                    await getTopicHierarchiesByChildName(trx)
                expect(
                    topicHierarchiesByChildName[
                        "CO2 & Greenhouse Gas Emissions"
                    ]
                ).toBeTruthy()
            },
            TransactionCloseMode.KeepOpen,
            env.testKnex
        )
    })

    it("computes breadcrumbs for a tag set", async () => {
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
                const labelsOnly = breadcrumbs.map((b) => b.label)
                expect(labelsOnly).toContain("Energy")
            },
            TransactionCloseMode.KeepOpen,
            env.testKnex
        )
    })
})
