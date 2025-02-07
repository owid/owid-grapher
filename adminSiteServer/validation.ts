import {
    DbPlainChart,
    DbPlainChartSlugRedirect,
    JsonError,
} from "@ourworldindata/types"
import * as db from "../db/db.js"
import { multiDimDataPageExists } from "../db/model/MultiDimDataPage.js"
import { isValidSlug } from "../serverUtils/serverUtil.js"

async function isSlugUsedInRedirect(
    knex: db.KnexReadonlyTransaction,
    slug: string,
    existingConfigId?: number
) {
    const rows = await db.knexRaw<DbPlainChartSlugRedirect>(
        knex,
        `SELECT * FROM chart_slug_redirects WHERE chart_id != ? AND slug = ?`,
        // -1 is a placeholder ID that will never exist; but we cannot use NULL because
        // in that case we would always get back an empty resultset
        [existingConfigId ?? -1, slug]
    )
    return rows.length > 0
}

async function isSlugUsedInOtherGrapher(
    knex: db.KnexReadonlyTransaction,
    slug: string,
    existingConfigId?: number
) {
    const rows = await db.knexRaw<Pick<DbPlainChart, "id">>(
        knex,
        `-- sql
                SELECT c.id
                FROM charts c
                JOIN chart_configs cc ON cc.id = c.configId
                WHERE
                    c.id != ?
                    AND cc.full ->> "$.isPublished" = "true"
                    AND cc.slug = ?
            `,
        // -1 is a placeholder ID that will never exist; but we cannot use NULL because
        // in that case we would always get back an empty resultset
        [existingConfigId ?? -1, slug]
    )
    return rows.length > 0
}

export async function validateGrapherSlug(
    knex: db.KnexReadonlyTransaction,
    slug: string,
    existingConfigId?: number
) {
    if (!isValidSlug(slug)) {
        throw new JsonError(`Invalid chart slug ${slug}`)
    }
    if (await isSlugUsedInRedirect(knex, slug, existingConfigId)) {
        throw new JsonError(
            `This chart slug was previously used by another chart: ${slug}`
        )
    }
    if (await isSlugUsedInOtherGrapher(knex, slug, existingConfigId)) {
        throw new JsonError(
            `This chart slug is in use by another published chart: ${slug}`
        )
    }
    if (await multiDimDataPageExists(knex, { slug })) {
        throw new JsonError(
            `This slug is in use by a multi-dimensional data page: ${slug}`
        )
    }
    return slug
}
