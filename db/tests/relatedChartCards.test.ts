import { expect, beforeAll, afterAll, test } from "vitest"

import knex, { Knex } from "knex"
import {
    ChartTagsTableName,
    RelatedChartsTableName,
    TagGraphRootName,
    TagGraphTableName,
    TagsTableName,
    UsersTableName,
} from "@ourworldindata/types"
import { dbTestConfig } from "./dbTestConfig.js"
import { cleanTestDb, insertTestChart } from "./testHelpers.js"
import { knexReadonlyTransaction, TransactionCloseMode } from "../db.js"
import { getRelatedChartCards } from "../model/RelatedChartCards.js"

let knexInstance: Knex<any, unknown[]> | undefined = undefined

const USER_ID = 1

// Tag graph used by these tests:
//
//   tag-graph-root
//   ├── Energy and Environment   (area)
//   │   ├── CO2 Emissions        <- the page's primary topic
//   │   │   └── CO2 by Sector    <- only reachable through the area
//   │   └── Energy               <- the page's second topic (not on the chart)
//   └── Health                   (area)
//       └── Life Expectancy
//   Unlisted                     (not in the graph)
const TAG_IDS = {
    root: 900,
    energyAndEnvironment: 901,
    co2Emissions: 902,
    co2BySector: 903,
    energy: 904,
    health: 905,
    lifeExpectancy: 906,
    unlisted: 907,
}

/** Chart ids by role, populated in beforeAll */
const charts: Record<string, number> = {}

beforeAll(async () => {
    knexInstance = knex(dbTestConfig)
    await cleanTestDb(knexInstance)

    // charts.lastEditedByUserId is a required foreign key
    await knexInstance(UsersTableName).insert({
        id: USER_ID,
        email: "admin@example.com",
        fullName: "Admin",
        createdAt: new Date(),
        updatedAt: new Date(),
    })

    await knexInstance(TagsTableName).insert([
        { id: TAG_IDS.root, name: TagGraphRootName },
        { id: TAG_IDS.energyAndEnvironment, name: "Energy and Environment" },
        { id: TAG_IDS.co2Emissions, name: "CO2 Emissions" },
        { id: TAG_IDS.co2BySector, name: "CO2 by Sector" },
        { id: TAG_IDS.energy, name: "Energy" },
        { id: TAG_IDS.health, name: "Health" },
        { id: TAG_IDS.lifeExpectancy, name: "Life Expectancy" },
        { id: TAG_IDS.unlisted, name: "Unlisted" },
    ])
    await knexInstance(TagGraphTableName).insert([
        { parentId: TAG_IDS.root, childId: TAG_IDS.energyAndEnvironment },
        { parentId: TAG_IDS.root, childId: TAG_IDS.health },
        {
            parentId: TAG_IDS.energyAndEnvironment,
            childId: TAG_IDS.co2Emissions,
        },
        { parentId: TAG_IDS.co2Emissions, childId: TAG_IDS.co2BySector },
        { parentId: TAG_IDS.energyAndEnvironment, childId: TAG_IDS.energy },
        { parentId: TAG_IDS.health, childId: TAG_IDS.lifeExpectancy },
    ])

    const specs: {
        role: string
        tagIds: number[]
        isPublished?: boolean
    }[] = [
        { role: "page", tagIds: [TAG_IDS.co2Emissions] },
        { role: "coviewed", tagIds: [TAG_IDS.lifeExpectancy] },
        { role: "co2Popular", tagIds: [TAG_IDS.co2Emissions] },
        { role: "co2Niche", tagIds: [TAG_IDS.co2Emissions] },
        { role: "energy", tagIds: [TAG_IDS.energy] },
        { role: "co2BySector", tagIds: [TAG_IDS.co2BySector] },
        { role: "health", tagIds: [TAG_IDS.lifeExpectancy] },
        {
            role: "co2Unlisted",
            tagIds: [TAG_IDS.co2Emissions, TAG_IDS.unlisted],
        },
        {
            role: "co2Draft",
            tagIds: [TAG_IDS.co2Emissions],
            isPublished: false,
        },
        { role: "untagged", tagIds: [] },
    ]
    for (const { role, tagIds, isPublished = true } of specs) {
        const { chartId } = await insertTestChart(knexInstance, {
            config: { slug: role, isPublished, title: role },
            lastEditedByUserId: USER_ID,
        })
        charts[role] = chartId
        for (const tagId of tagIds)
            await knexInstance(ChartTagsTableName).insert({ chartId, tagId })
    }

    const good = (chartId: number, relatedChartId: number, score: number) => ({
        chartId,
        relatedChartId,
        label: "good",
        reviewer: "production",
        score,
    })
    await knexInstance(RelatedChartsTableName).insert([
        // the page's only coview recommendation
        good(charts.page, charts.coviewed, 0.9),
        // aggregate coview scores, received from other pages: co2Popular is
        // recommended more than co2Niche, and the excluded charts most of all
        good(charts.health, charts.co2Popular, 0.8),
        good(charts.health, charts.co2Niche, 0.3),
        good(charts.health, charts.co2Unlisted, 5),
        good(charts.health, charts.co2Draft, 5),
        // a self-reference doesn't count towards the aggregate
        good(charts.co2Niche, charts.co2Niche, 10),
    ])
})

afterAll(async () => {
    if (knexInstance) await cleanTestDb(knexInstance)
    await Promise.allSettled([knexInstance?.destroy()])
})

async function cards(
    chartId: number,
    topicTagNames: string[]
): Promise<[string, string | undefined][]> {
    return knexReadonlyTransaction(
        async (trx) =>
            (await getRelatedChartCards(trx, chartId, topicTagNames)).map(
                (c) => [c.slug, c.source]
            ),
        TransactionCloseMode.KeepOpen,
        knexInstance
    )
}

test("coviews come first, then topics ranked by aggregate coview score, then the area", async () => {
    expect(
        await cards(charts.page, ["CO2 Emissions", "Energy", "No Such Topic"])
    ).toEqual([
        ["coviewed", "coviews"],
        ["co2Popular", "primary-topic"],
        ["co2Niche", "primary-topic"],
        ["energy", "other-topics"],
        ["co2BySector", "topic-area"],
    ])
})

test("the chart's own topic tags stand in when the indicator lists none", async () => {
    // CO2 Emissions is on the chart; Energy only came from the indicator
    const result = await cards(charts.page, [])
    expect(result.slice(0, 3)).toEqual([
        ["coviewed", "coviews"],
        ["co2Popular", "primary-topic"],
        ["co2Niche", "primary-topic"],
    ])
    expect(result.slice(3).map(([, source]) => source)).toEqual([
        "topic-area",
        "topic-area",
    ])
})

test("a page with no coviews and no topics falls back to site-wide", async () => {
    const result = await cards(charts.untagged, [])
    expect(result.slice(0, 3)).toEqual([
        ["coviewed", "site-wide"],
        ["co2Popular", "site-wide"],
        ["co2Niche", "site-wide"],
    ])
    expect(result).toHaveLength(5)
})

test("unpublished, unlisted and the page's own chart never appear", async () => {
    for (const [role, topics] of [
        ["page", ["CO2 Emissions"]],
        ["untagged", []],
    ] as const) {
        const slugs = (await cards(charts[role], [...topics])).map(
            ([slug]) => slug
        )
        expect(slugs).not.toContain("co2Unlisted")
        expect(slugs).not.toContain("co2Draft")
        expect(slugs).not.toContain(role)
    }
})
