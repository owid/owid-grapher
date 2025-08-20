import {
    DbPlainTag,
    DbPlainDataset,
    DbRawPostGdoc,
    JsonError,
} from "@ourworldindata/types"
import {
    OldChartFieldList,
    oldChartFieldList,
    assignTagsForCharts,
} from "../../db/model/Chart.js"
import { expectInt } from "../../serverUtils/serverUtil.js"
import { UNCATEGORIZED_TAG_ID } from "../../settings/serverSettings.js"
import * as db from "../../db/db.js"
import * as lodash from "lodash-es"
import e from "express"
import { Request } from "../authentication.js"
import * as R from "remeda"

export async function getTagById(
    req: Request,
    _res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadonlyTransaction
) {
    const tagId = expectInt(req.params.tagId) as number | null

    // NOTE (Mispy): The "uncategorized" tag is special -- it represents all untagged stuff
    // Bit fiddly to handle here but more true to normalized schema than having to remember to add the special tag
    // every time we create a new chart etcs
    const uncategorized = tagId === UNCATEGORIZED_TAG_ID

    // TODO: when we have types for our endpoints, make tag of that type instead of any
    const tag: any = await db.knexRawFirst<
        Pick<
            DbPlainTag,
            "id" | "name" | "specialType" | "updatedAt" | "parentId" | "slug"
        >
    >(
        trx,
        `-- sql
        SELECT t.id, t.name, t.specialType, t.updatedAt, t.parentId, t.slug
        FROM tags t LEFT JOIN tags p ON t.parentId=p.id
        WHERE t.id = ?
    `,
        [tagId]
    )

    // Datasets tagged with this tag
    const datasets = await db.knexRaw<
        Pick<
            DbPlainDataset,
            | "id"
            | "namespace"
            | "name"
            | "description"
            | "createdAt"
            | "updatedAt"
            | "dataEditedAt"
            | "isPrivate"
            | "nonRedistributable"
        > & { dataEditedByUserName: string }
    >(
        trx,
        `-- sql
        SELECT
            d.id,
            d.namespace,
            d.name,
            d.description,
            d.createdAt,
            d.updatedAt,
            d.dataEditedAt,
            du.fullName AS dataEditedByUserName,
            d.isPrivate,
            d.nonRedistributable
        FROM active_datasets d
        JOIN users du ON du.id=d.dataEditedByUserId
        LEFT JOIN dataset_tags dt ON dt.datasetId = d.id
        WHERE dt.tagId ${uncategorized ? "IS NULL" : "= ?"}
        ORDER BY d.dataEditedAt DESC
    `,
        uncategorized ? [] : [tagId]
    )
    tag.datasets = datasets

    // The other tags for those datasets
    if (tag.datasets.length) {
        if (uncategorized) {
            for (const dataset of tag.datasets) dataset.tags = []
        } else {
            const datasetTags = await db.knexRaw<{
                datasetId: number
                id: number
                name: string
            }>(
                trx,
                `-- sql
                SELECT dt.datasetId, t.id, t.name FROM dataset_tags dt
                JOIN tags t ON dt.tagId = t.id
                WHERE dt.datasetId IN (?)
            `,
                [tag.datasets.map((d: any) => d.id)]
            )
            const tagsByDatasetId = lodash.groupBy(
                datasetTags,
                (t) => t.datasetId
            )
            for (const dataset of tag.datasets) {
                dataset.tags = tagsByDatasetId[dataset.id].map((t) =>
                    lodash.omit(t, "datasetId")
                )
            }
        }
    }

    // Charts using datasets under this tag
    const charts = await db.knexRaw<OldChartFieldList>(
        trx,
        `-- sql
                SELECT ${oldChartFieldList},
                    round(views_365d / 365, 1) as pageviewsPerDay,
                    crv.narrativeChartsCount,
                    crv.referencesCount
                FROM charts
                JOIN chart_configs ON chart_configs.id = charts.configId
                LEFT JOIN chart_tags ct ON ct.chartId=charts.id
                JOIN users lastEditedByUser ON lastEditedByUser.id = charts.lastEditedByUserId
                LEFT JOIN users publishedByUser ON publishedByUser.id = charts.publishedByUserId
                LEFT JOIN analytics_pageviews on (analytics_pageviews.url = CONCAT("https://ourworldindata.org/grapher/", chart_configs.slug) AND chart_configs.full ->> '$.isPublished' = "true" )
                LEFT JOIN chart_references_view crv ON crv.chartId = charts.id
                WHERE ct.tagId ${tagId === UNCATEGORIZED_TAG_ID ? "IS NULL" : "= ?"}
                GROUP BY charts.id, views_365d, crv.narrativeChartsCount, crv.referencesCount
                ORDER BY charts.updatedAt DESC
            `,
        uncategorized ? [] : [tagId]
    )
    tag.charts = charts

    await assignTagsForCharts(trx, charts)

    // Subcategories
    const children = await db.knexRaw<{ id: number; name: string }>(
        trx,
        `-- sql
        SELECT t.id, t.name FROM tags t
        WHERE t.parentId = ?
    `,
        [tag.id]
    )
    tag.children = children

    const possibleParents = await db.knexRaw<{ id: number; name: string }>(
        trx,
        `-- sql
        SELECT t.id, t.name FROM tags t
        WHERE t.parentId IS NULL
    `
    )
    tag.possibleParents = possibleParents

    return {
        tag,
    }
}

export async function updateTag(
    req: Request,
    _res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadWriteTransaction
) {
    const tagId = expectInt(req.params.tagId)
    const tag = (req.body as { tag: any }).tag
    await db.knexRaw(
        trx,
        `UPDATE tags SET name=?, updatedAt=?, slug=? WHERE id=?`,
        [tag.name, new Date(), tag.slug, tagId]
    )
    if (tag.slug) {
        // See if there's a published gdoc with a matching slug.
        // We're not enforcing that the gdoc be a topic page, as there are cases like /human-development-index,
        // where the page for the topic is just an article.
        const gdoc = await db.knexRaw<Pick<DbRawPostGdoc, "slug">>(
            trx,
            `-- sql
                SELECT slug FROM posts_gdocs pg
                WHERE EXISTS (
                        SELECT 1
                        FROM posts_gdocs_x_tags gt
                        WHERE pg.id = gt.gdocId AND gt.tagId = ?
                ) AND pg.published = TRUE AND pg.slug = ?`,
            [tagId, tag.slug]
        )
        if (!gdoc.length) {
            return {
                success: true,
                tagUpdateWarning: `The tag's slug has been updated, but there isn't a published Gdoc page with the same slug.

Are you sure you haven't made a typo?`,
            }
        }
    }
    return { success: true }
}

export async function createTag(
    req: Request,
    _res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadWriteTransaction
) {
    const tag = req.body
    function validateTag(
        tag: unknown
    ): tag is { name: string; slug: string | null } {
        return (
            R.isPlainObject(tag) &&
            typeof tag.name === "string" &&
            (tag.slug === null ||
                (typeof tag.slug === "string" && tag.slug !== ""))
        )
    }
    if (!validateTag(tag)) throw new JsonError("Invalid tag", 400)

    const conflictingTag = await db.knexRawFirst<{
        name: string
        slug: string | null
    }>(
        trx,
        `SELECT name, slug FROM tags WHERE name = ? OR (slug IS NOT NULL AND slug = ?)`,
        [tag.name, tag.slug]
    )
    if (conflictingTag)
        throw new JsonError(
            conflictingTag.name === tag.name
                ? `Tag with name ${tag.name} already exists`
                : `Tag with slug ${tag.slug} already exists`,
            400
        )

    const now = new Date()
    const result = await db.knexRawInsert(
        trx,
        `INSERT INTO tags (name, slug, createdAt, updatedAt) VALUES (?, ?, ?, ?)`,
        // parentId will be deprecated soon once we migrate fully to the tag graph
        [tag.name, tag.slug, now, now]
    )
    return { success: true, tagId: result.insertId }
}

export async function getAllTags(
    req: Request,
    _res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadonlyTransaction
) {
    return { tags: await db.getMinimalTagsWithIsTopic(trx) }
}

export async function deleteTag(
    req: Request,
    _res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadWriteTransaction
) {
    const tagId = expectInt(req.params.tagId)

    await db.knexRaw(trx, `DELETE FROM tags WHERE id=?`, [tagId])

    return { success: true }
}
