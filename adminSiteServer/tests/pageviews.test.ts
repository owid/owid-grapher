import { expect, beforeAll, beforeEach, afterAll, describe, it } from "vitest"

import { dbTestConfig } from "../../db/tests/dbTestConfig.js"
import knex, { Knex } from "knex"
import {
    knexReadWriteTransaction,
    KnexReadWriteTransaction,
    TransactionCloseMode,
} from "../../db/db.js"
import { cleanTestDb } from "../../db/tests/testHelpers.js"
import { v7 as uuidv7 } from "uuid"
import {
    AnalyticsChartViewsTableName,
    AnalyticsChartViewsType,
    ChartConfigsTableName,
    DbInsertChartConfig,
    DbInsertMultiDimDataPage,
    DbInsertMultiDimRedirect,
    MultiDimDataPagesTableName,
    MultiDimRedirectsTableName,
} from "@ourworldindata/types"
import {
    getChartViewsMap,
    getMaxChartViewsFromMultiDimPredecessors,
} from "../../baker/algolia/utils/pageviews.js"

let knexInstance: Knex<any, unknown[]> | undefined = undefined

beforeAll(() => {
    knexInstance = knex(dbTestConfig)
})

beforeEach(async () => {
    // multi_dim_redirects and analytics_chart_views aren't in TABLES_IN_USE, so
    // cleanTestDb won't touch them. Delete redirects first — it has FKs to
    // multi_dim_data_pages and chart_configs, which cleanTestDb clears next.
    await knexInstance!(MultiDimRedirectsTableName).delete()
    await knexInstance!(AnalyticsChartViewsTableName).delete()
    await cleanTestDb(knexInstance!)
})

afterAll(async () => {
    await Promise.allSettled([knexInstance?.destroy()])
})

/**
 * Builds a minimal valid multi-dim config JSON string with a single dimension
 * ("view") whose choices are the given slugs. Each choice maps to a view with
 * the supplied fullConfigId. The default view (first choice) is `choices[0]`.
 */
function buildMultiDimConfig(
    choicesWithConfigIds: { slug: string; fullConfigId: string }[]
): string {
    return JSON.stringify({
        title: { title: "Test multi-dim" },
        dimensions: [
            {
                slug: "view",
                name: "View",
                choices: choicesWithConfigIds.map(({ slug }) => ({
                    slug,
                    name: slug,
                })),
            },
        ],
        views: choicesWithConfigIds.map(({ slug, fullConfigId }) => ({
            dimensions: { view: slug },
            indicators: { y: [{ id: 1 }] },
            fullConfigId,
        })),
    })
}

/** Inserts a multi_dim_data_pages row and returns its auto-increment id. */
async function insertMultiDim(
    trx: KnexReadWriteTransaction,
    config: string
): Promise<number> {
    const row: DbInsertMultiDimDataPage = {
        catalogPath: `grapher/test/${uuidv7()}`,
        slug: `test-mdim-${uuidv7()}`,
        config,
        published: true,
    }
    const [id] = await trx(MultiDimDataPagesTableName).insert(row)
    return id
}

/** Inserts a chart_configs row and returns its UUID id. */
async function insertChartConfig(
    trx: KnexReadWriteTransaction
): Promise<string> {
    const id = uuidv7()
    const row: DbInsertChartConfig = { id, patch: "{}", full: "{}" }
    await trx(ChartConfigsTableName).insert(row)
    return id
}

async function insertRedirect(
    trx: KnexReadWriteTransaction,
    redirect: {
        source: string
        multiDimId: number
        viewConfigId?: string | null
    }
): Promise<void> {
    const row: DbInsertMultiDimRedirect = {
        source: redirect.source,
        multiDimId: redirect.multiDimId,
        viewConfigId: redirect.viewConfigId ?? null,
    }
    await trx(MultiDimRedirectsTableName).insert(row)
}

async function insertChartView(
    trx: KnexReadWriteTransaction,
    view: {
        chart_slug?: string
        view_config_id?: string
        type: AnalyticsChartViewsType
        views_7d: number
    }
): Promise<void> {
    await trx(AnalyticsChartViewsTableName).insert({
        day: "2024-01-01",
        chart_slug: view.chart_slug ?? "",
        view_config_id: view.view_config_id ?? "",
        type: view.type,
        views_7d: view.views_7d,
        views_14d: 0,
        views_365d: 0,
    })
}

/** Runs `fn` inside a read-write transaction bound to the shared knex instance. */
function withTrx<T>(
    fn: (trx: KnexReadWriteTransaction) => Promise<T>
): Promise<T> {
    return knexReadWriteTransaction(
        fn,
        TransactionCloseMode.KeepOpen,
        knexInstance
    )
}

describe(getMaxChartViewsFromMultiDimPredecessors, () => {
    it("returns an empty map when there are no redirects", async () => {
        const result = await withTrx(getMaxChartViewsFromMultiDimPredecessors)
        expect(result.size).toBe(0)
    })

    it("resolves a redirect with an explicit viewConfigId to that config", async () => {
        const result = await withTrx(async (trx) => {
            const mdimId = await insertMultiDim(
                trx,
                buildMultiDimConfig([{ slug: "a", fullConfigId: uuidv7() }])
            )
            const multiDimChartConfigId = await insertChartConfig(trx)
            await insertRedirect(trx, {
                source: "/grapher/old",
                multiDimId: mdimId,
                viewConfigId: multiDimChartConfigId,
            })
            await insertChartView(trx, {
                chart_slug: "old",
                type: "grapher_chart",
                views_7d: 42,
            })
            const map = await getMaxChartViewsFromMultiDimPredecessors(trx)
            return { map, multiDimChartConfigId }
        })
        expect(result.map.get(result.multiDimChartConfigId)).toBe(42)
        expect(result.map.size).toBe(1)
    })

    it("resolves a redirect without a viewConfigId to the multi-dim's default view", async () => {
        const defaultConfigId = uuidv7()
        const result = await withTrx(async (trx) => {
            const mdimId = await insertMultiDim(
                trx,
                buildMultiDimConfig([
                    { slug: "a", fullConfigId: defaultConfigId },
                    { slug: "b", fullConfigId: uuidv7() },
                ])
            )
            await insertRedirect(trx, {
                source: "/grapher/old",
                multiDimId: mdimId,
                viewConfigId: null,
            })
            await insertChartView(trx, {
                chart_slug: "old",
                type: "grapher_chart",
                views_7d: 7,
            })
            return getMaxChartViewsFromMultiDimPredecessors(trx)
        })
        // Default view = first choice ("a") → defaultConfigId
        expect(result.get(defaultConfigId)).toBe(7)
        expect(result.size).toBe(1)
    })

    it("takes the max across multiple redirects targeting the same view", async () => {
        const result = await withTrx(async (trx) => {
            const mdimId = await insertMultiDim(
                trx,
                buildMultiDimConfig([{ slug: "a", fullConfigId: uuidv7() }])
            )
            const multiDimChartConfigId = await insertChartConfig(trx)
            await insertRedirect(trx, {
                source: "/grapher/a",
                multiDimId: mdimId,
                viewConfigId: multiDimChartConfigId,
            })
            await insertRedirect(trx, {
                source: "/explorers/b",
                multiDimId: mdimId,
                viewConfigId: multiDimChartConfigId,
            })
            await insertChartView(trx, {
                chart_slug: "a",
                type: "grapher_chart",
                views_7d: 50,
            })
            await insertChartView(trx, {
                chart_slug: "b",
                type: "explorer",
                views_7d: 100,
            })
            const map = await getMaxChartViewsFromMultiDimPredecessors(trx)
            return { map, multiDimChartConfigId }
        })
        expect(result.map.get(result.multiDimChartConfigId)).toBe(100)
    })

    it("resolves explorer and grapher sources sharing a slug from their own namespaces", async () => {
        const result = await withTrx(async (trx) => {
            const mdimId = await insertMultiDim(
                trx,
                buildMultiDimConfig([{ slug: "a", fullConfigId: uuidv7() }])
            )
            const multiDimChartConfigId1 = await insertChartConfig(trx)
            const multiDimChartConfigId2 = await insertChartConfig(trx)
            await insertRedirect(trx, {
                source: "/explorers/dup",
                multiDimId: mdimId,
                viewConfigId: multiDimChartConfigId1,
            })
            await insertRedirect(trx, {
                source: "/grapher/dup",
                multiDimId: mdimId,
                viewConfigId: multiDimChartConfigId2,
            })
            await insertChartView(trx, {
                chart_slug: "dup",
                type: "explorer",
                views_7d: 9,
            })
            await insertChartView(trx, {
                chart_slug: "dup",
                type: "grapher_chart",
                views_7d: 3,
            })
            const map = await getMaxChartViewsFromMultiDimPredecessors(trx)
            return { map, multiDimChartConfigId1, multiDimChartConfigId2 }
        })
        expect(result.map.get(result.multiDimChartConfigId1)).toBe(9)
        expect(result.map.get(result.multiDimChartConfigId2)).toBe(3)
    })

    it("treats multidim-type analytics rows as part of the grapher namespace", async () => {
        const result = await withTrx(async (trx) => {
            const mdimId = await insertMultiDim(
                trx,
                buildMultiDimConfig([{ slug: "a", fullConfigId: uuidv7() }])
            )
            const multiDimChartConfigId = await insertChartConfig(trx)
            await insertRedirect(trx, {
                source: "/grapher/m",
                multiDimId: mdimId,
                viewConfigId: multiDimChartConfigId,
            })
            await insertChartView(trx, {
                chart_slug: "m",
                type: "multidim",
                views_7d: 11,
            })
            const map = await getMaxChartViewsFromMultiDimPredecessors(trx)
            return { map, multiDimChartConfigId }
        })
        expect(result.map.get(result.multiDimChartConfigId)).toBe(11)
    })

    it("takes the max views across multiple analytics rows sharing a chart_slug", async () => {
        // A multidim has one analytics row per view, all sharing the mdim slug
        // as chart_slug. The source must resolve to the highest, not an
        // arbitrary one.
        const result = await withTrx(async (trx) => {
            const mdimId = await insertMultiDim(
                trx,
                buildMultiDimConfig([{ slug: "a", fullConfigId: uuidv7() }])
            )
            const multiDimChartConfigId = await insertChartConfig(trx)
            await insertRedirect(trx, {
                source: "/grapher/shared",
                multiDimId: mdimId,
                viewConfigId: multiDimChartConfigId,
            })
            await insertChartView(trx, {
                chart_slug: "shared",
                view_config_id: "view-1",
                type: "multidim",
                views_7d: 5,
            })
            await insertChartView(trx, {
                chart_slug: "shared",
                view_config_id: "view-2",
                type: "multidim",
                views_7d: 30,
            })
            await insertChartView(trx, {
                chart_slug: "shared",
                view_config_id: "view-3",
                type: "multidim",
                views_7d: 12,
            })
            const map = await getMaxChartViewsFromMultiDimPredecessors(trx)
            return { map, multiDimChartConfigId }
        })
        expect(result.map.get(result.multiDimChartConfigId)).toBe(30)
    })

    it("skips a redirect whose source has no matching analytics row", async () => {
        const result = await withTrx(async (trx) => {
            const mdimId = await insertMultiDim(
                trx,
                buildMultiDimConfig([{ slug: "a", fullConfigId: uuidv7() }])
            )
            const multiDimChartConfigId = await insertChartConfig(trx)
            await insertRedirect(trx, {
                source: "/grapher/orphan",
                multiDimId: mdimId,
                viewConfigId: multiDimChartConfigId,
            })
            // analytics row for a different slug — shouldn't match
            await insertChartView(trx, {
                chart_slug: "something-else",
                type: "grapher_chart",
                views_7d: 99,
            })
            return getMaxChartViewsFromMultiDimPredecessors(trx)
        })
        expect(result.size).toBe(0)
    })

    it("skips a redirect whose multi-dim default view can't be resolved", async () => {
        const result = await withTrx(async (trx) => {
            // Config with no dimensions/views → getDefaultView() is undefined
            const mdimId = await insertMultiDim(
                trx,
                JSON.stringify({
                    title: { title: "Empty" },
                    dimensions: [],
                    views: [],
                })
            )
            await insertRedirect(trx, {
                source: "/grapher/x",
                multiDimId: mdimId,
                viewConfigId: null,
            })
            await insertChartView(trx, {
                chart_slug: "x",
                type: "grapher_chart",
                views_7d: 5,
            })
            return getMaxChartViewsFromMultiDimPredecessors(trx)
        })
        expect(result.size).toBe(0)
    })
})

describe(getChartViewsMap, () => {
    it("returns empty maps when the table is empty", async () => {
        const result = await withTrx(getChartViewsMap)
        expect(result.byConfigId.size).toBe(0)
        expect(result.byGrapherSlug.size).toBe(0)
    })

    it("routes rows with a view_config_id into byConfigId", async () => {
        const result = await withTrx(async (trx) => {
            await insertChartView(trx, {
                view_config_id: "cfg-1",
                type: "explorer",
                views_7d: 30,
            })
            return getChartViewsMap(trx)
        })
        expect(result.byConfigId.get("cfg-1")).toBe(30)
        expect(result.byGrapherSlug.size).toBe(0)
    })

    it("routes rows without a view_config_id into byGrapherSlug", async () => {
        const result = await withTrx(async (trx) => {
            await insertChartView(trx, {
                chart_slug: "life-expectancy",
                view_config_id: "",
                type: "grapher_chart",
                views_7d: 80,
            })
            return getChartViewsMap(trx)
        })
        expect(result.byGrapherSlug.get("life-expectancy")).toBe(80)
        expect(result.byConfigId.size).toBe(0)
    })

    it("prefers view_config_id over chart_slug when both are present", async () => {
        const result = await withTrx(async (trx) => {
            await insertChartView(trx, {
                chart_slug: "both",
                view_config_id: "cfg-2",
                type: "explorer",
                views_7d: 5,
            })
            return getChartViewsMap(trx)
        })
        expect(result.byConfigId.get("cfg-2")).toBe(5)
        expect(result.byGrapherSlug.has("both")).toBe(false)
    })

    it("drops rows with neither a view_config_id nor a chart_slug", async () => {
        const result = await withTrx(async (trx) => {
            await insertChartView(trx, {
                chart_slug: "",
                view_config_id: "",
                type: "grapher_chart",
                views_7d: 1,
            })
            return getChartViewsMap(trx)
        })
        expect(result.byConfigId.size).toBe(0)
        expect(result.byGrapherSlug.size).toBe(0)
    })
})
