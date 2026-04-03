import {
    JsonError,
    TagsTableName,
    FeaturedMetricsTableName,
} from "@ourworldindata/types"
import { HonoContext } from "../authentication.js"
import * as db from "../../db/db.js"

export async function createFeaturedMetric(
    c: HonoContext,
    trx: db.KnexReadonlyTransaction
) {
    const body = await c.req.json()
    const { url, parentTagName, ranking, incomeGroup } = body

    if (!url || !parentTagName || !ranking || !incomeGroup) {
        throw new JsonError("Missing required fields", 400)
    }

    const { isValid, reason } = await db.validateChartSlug(trx, url)

    if (!isValid) {
        throw new JsonError(`Invalid Featured Metric URL. ${reason}`, 400)
    }

    // Get the parentTagId from the parentTagName
    const parentTag = await trx(TagsTableName)
        .select("id")
        .where({
            name: parentTagName,
        })
        .first()

    if (!parentTag) {
        throw new JsonError(
            `No parent tag found with name '${parentTagName}'`,
            404
        )
    }
    const parentTagId = parentTag.id

    const duplicateFeaturedMetric = await trx(FeaturedMetricsTableName)
        .where({
            url,
            parentTagId,
            incomeGroup,
        })
        .first()

    if (duplicateFeaturedMetric) {
        throw new JsonError(
            `Featured Metric with URL "${url}", income group "${incomeGroup}", and parentTagName "${parentTagName}" already exists`,
            400
        )
    }

    await db.knexRaw(
        trx,
        `INSERT INTO ${FeaturedMetricsTableName} (url, parentTagId, ranking, incomeGroup)
         VALUES (?, ?, ?, ?)`,
        [url, parentTagId, ranking, incomeGroup]
    )

    return { success: true }
}

export async function rerankFeaturedMetrics(
    c: HonoContext,
    trx: db.KnexReadonlyTransaction
) {
    const featuredMetrics = await c.req.json()

    if (!featuredMetrics || !Array.isArray(featuredMetrics)) {
        throw new JsonError("Invalid payload signature", 400)
    }

    for (const { id, ranking } of featuredMetrics) {
        if (id === undefined || ranking === undefined) {
            throw new JsonError("Missing required fields", 400)
        }

        await db.knexRaw(
            trx,
            `UPDATE ${FeaturedMetricsTableName} SET ranking = ? WHERE id = ?`,
            [ranking, id]
        )
    }

    return { success: true }
}

export async function deleteFeaturedMetric(
    c: HonoContext,
    trx: db.KnexReadonlyTransaction
) {
    const id = c.req.param("id")!

    const featuredMetric = await trx(FeaturedMetricsTableName)
        .where({ id })
        .first()
    if (!featuredMetric) {
        throw new JsonError(`No Featured Metric found with id '${id}'`, 404)
    }

    await trx(FeaturedMetricsTableName).where({ id }).delete()

    await trx(FeaturedMetricsTableName)
        .where({
            parentTagId: featuredMetric.parentTagId,
            incomeGroup: featuredMetric.incomeGroup,
        })
        .andWhere("ranking", ">", featuredMetric.ranking)
        .decrement("ranking", 1)

    return { success: true }
}

export async function fetchFeaturedMetrics(
    _c: HonoContext,
    trx: db.KnexReadonlyTransaction
) {
    const featuredMetrics = await db.getFeaturedMetricsByParentTagName(trx)

    return { featuredMetrics }
}
