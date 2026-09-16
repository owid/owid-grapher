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
import { getRelatedChartsForChart } from "../model/Chart.js"

let knexInstance: Knex<any, unknown[]> | undefined = undefined

const USER_ID = 1

// Tag graph used by these tests:
//
//   tag-graph-root
//   ├── Energy and Environment   (area)
//   │   ├── CO2 Emissions        <- source chart and `sameTag` are tagged with this
//   │   └── Energy               <- `sameArea` is tagged with this
//   └── Health                   (area)
//       └── Life Expectancy      <- `unrelated` is tagged with this
const TAG_IDS = {
    root: 900,
    energyAndEnvironment: 901,
    co2Emissions: 902,
    energy: 903,
    health: 904,
    lifeExpectancy: 905,
}

/** Charts by role, populated in beforeAll. */
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
        { id: TAG_IDS.energy, name: "Energy" },
        { id: TAG_IDS.health, name: "Health" },
        { id: TAG_IDS.lifeExpectancy, name: "Life Expectancy" },
    ])
    await knexInstance(TagGraphTableName).insert([
        { parentId: TAG_IDS.root, childId: TAG_IDS.energyAndEnvironment },
        { parentId: TAG_IDS.root, childId: TAG_IDS.health },
        {
            parentId: TAG_IDS.energyAndEnvironment,
            childId: TAG_IDS.co2Emissions,
        },
        { parentId: TAG_IDS.energyAndEnvironment, childId: TAG_IDS.energy },
        { parentId: TAG_IDS.health, childId: TAG_IDS.lifeExpectancy },
    ])

    // The source chart plus three candidates, deliberately scored so that raw
    // coview order is the *reverse* of the order we expect back.
    const specs: { role: string; slug: string; tagId: number }[] = [
        { role: "source", slug: "source-chart", tagId: TAG_IDS.co2Emissions },
        { role: "sameTag", slug: "same-tag", tagId: TAG_IDS.co2Emissions },
        { role: "sameArea", slug: "same-area", tagId: TAG_IDS.energy },
        { role: "unrelated", slug: "unrelated", tagId: TAG_IDS.lifeExpectancy },
    ]
    for (const { role, slug, tagId } of specs) {
        const { chartId } = await insertTestChart(knexInstance, {
            config: { slug, isPublished: true, title: slug },
            lastEditedByUserId: USER_ID,
        })
        charts[role] = chartId
        await knexInstance(ChartTagsTableName).insert({ chartId, tagId })
    }

    await knexInstance(RelatedChartsTableName).insert([
        {
            chartId: charts.source,
            relatedChartId: charts.unrelated,
            label: "good",
            reviewer: "production",
            score: 0.9,
        },
        {
            chartId: charts.source,
            relatedChartId: charts.sameArea,
            label: "good",
            reviewer: "production",
            score: 0.5,
        },
        {
            chartId: charts.source,
            relatedChartId: charts.sameTag,
            label: "good",
            reviewer: "production",
            score: 0.1,
        },
    ])
})

afterAll(async () => {
    if (knexInstance) await cleanTestDb(knexInstance)
    await Promise.allSettled([knexInstance?.destroy()])
})

async function relatedSlugs(
    chartId: number,
    limit?: number
): Promise<string[]> {
    return knexReadonlyTransaction(
        async (trx) =>
            (await getRelatedChartsForChart(trx, chartId, limit)).map(
                (c) => c.slug
            ),
        TransactionCloseMode.KeepOpen,
        knexInstance
    )
}

test("related charts are tiered by tag, then area, then score", async () => {
    // Raw coview score would give unrelated > same-area > same-tag; tiering
    // reverses that.
    expect(await relatedSlugs(charts.source)).toEqual([
        "same-tag",
        "same-area",
        "unrelated",
    ])
})

test("a chart with no topical candidates still gets a full list", async () => {
    // Nothing in the pool shares a tag or an area with this source, so all
    // candidates land in the last tier and plain score order applies.
    const { chartId: lonelyId } = await insertTestChart(knexInstance!, {
        config: { slug: "lonely", isPublished: true, title: "lonely" },
        lastEditedByUserId: USER_ID,
    })
    await knexInstance!(RelatedChartsTableName).insert([
        {
            chartId: lonelyId,
            relatedChartId: charts.unrelated,
            label: "good",
            reviewer: "production",
            score: 0.2,
        },
        {
            chartId: lonelyId,
            relatedChartId: charts.sameTag,
            label: "good",
            reviewer: "production",
            score: 0.7,
        },
    ])

    expect(await relatedSlugs(lonelyId)).toEqual(["same-tag", "unrelated"])
})

test("the limit is applied after re-ranking, not before", async () => {
    expect(await relatedSlugs(charts.source, 1)).toEqual(["same-tag"])
})

test("unpublished, unlisted and non-production candidates are excluded", async () => {
    const { chartId: draftId } = await insertTestChart(knexInstance!, {
        config: { slug: "draft", isPublished: false, title: "draft" },
        lastEditedByUserId: USER_ID,
    })
    const { chartId: reviewedId } = await insertTestChart(knexInstance!, {
        config: { slug: "reviewed", isPublished: true, title: "reviewed" },
        lastEditedByUserId: USER_ID,
    })
    await knexInstance!(RelatedChartsTableName).insert([
        {
            chartId: charts.source,
            relatedChartId: draftId,
            label: "good",
            reviewer: "production",
            score: 1,
        },
        // a row written during manual review, not by the ETL
        {
            chartId: charts.source,
            relatedChartId: reviewedId,
            label: "good",
            reviewer: "someone",
            score: 1,
        },
    ])

    const slugs = await relatedSlugs(charts.source)
    expect(slugs).not.toContain("draft")
    expect(slugs).not.toContain("reviewed")
})
