import {
    DbPlainMultiDimDataPage,
    JsonError,
    MultiDimDataPageConfigRaw,
    MultiDimDataPagesTableName,
} from "@ourworldindata/types"
import { getMultiDimDataPageById } from "../../db/model/MultiDimDataPage.js"
import { expectInt } from "../../serverUtils/serverUtil.js"
import {
    upsertMultiDim,
    setMultiDimPublished,
    setMultiDimSlug,
} from "../multiDim.js"
import { triggerStaticBuild } from "../../baker/GrapherBakingUtils.js"
import { Request } from "../authentication.js"
import * as db from "../../db/db.js"
import {
    validateNewGrapherSlug,
    validateMultiDimSlug,
    isValidCatalogPath,
} from "../validation.js"
import e from "express"

export async function handleGetMultiDims(
    _req: Request,
    _res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadonlyTransaction
) {
    try {
        const results = await db.knexRaw<
            Pick<
                DbPlainMultiDimDataPage,
                "id" | "catalogPath" | "slug" | "updatedAt" | "published"
            > & { title: string }
        >(
            trx,
            `-- sql
            SELECT
                id,
                catalogPath,
                slug,
                config->>'$.title.title' as title,
                updatedAt,
                published
            FROM ${MultiDimDataPagesTableName}`
        )
        const multiDims = results.map((row) => ({
            ...row,
            published: Boolean(row.published),
        }))
        return { multiDims }
    } catch (error) {
        throw new JsonError("Failed to fetch multi-dims", 500, { cause: error })
    }
}

export async function handlePutMultiDim(
    req: Request,
    res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadWriteTransaction
) {
    const { catalogPath } = req.params
    if (!isValidCatalogPath(catalogPath)) {
        throw new JsonError(`Invalid multi-dim catalog path ${catalogPath}`)
    }
    const { config: rawConfig } = req.body as {
        config: MultiDimDataPageConfigRaw
    }
    const id = await upsertMultiDim(trx, catalogPath, rawConfig)

    const { slug: publishedSlug } =
        (await trx<DbPlainMultiDimDataPage>(MultiDimDataPagesTableName)
            .select("slug")
            .where("catalogPath", catalogPath)
            .where("published", true)
            .first()) ?? {}
    if (publishedSlug) {
        await triggerStaticBuild(
            res.locals.user,
            `Publishing multidimensional chart ${publishedSlug}`
        )
    }
    return { success: true, id }
}

export async function handlePatchMultiDim(
    req: Request,
    res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadWriteTransaction
) {
    const id = expectInt(req.params.id)
    let multiDim = await getMultiDimDataPageById(trx, id)
    if (!multiDim) {
        throw new JsonError(`Multi-dimensional data page not found`, 404)
    }
    const { published, slug } = req.body
    let action
    if (slug !== undefined && slug !== multiDim.slug) {
        await validateNewGrapherSlug(trx, slug)
        multiDim = await setMultiDimSlug(trx, multiDim, slug)
        if (multiDim.published) {
            action = "publish"
        }
    }
    // Note: Keep this change last, since we don't want to update the configs
    // in R2 when a previous operation fails.
    if (published !== undefined && published !== multiDim.published) {
        if (published) {
            await validateMultiDimSlug(trx, multiDim.slug)
        }
        multiDim = await setMultiDimPublished(trx, multiDim, published)
        action = published ? "publish" : "unpublish"
    }
    if (action) {
        await triggerStaticBuild(
            res.locals.user,
            `${action === "publish" ? "Publishing" : "Unpublishing"} multidimensional chart ${multiDim.slug}`
        )
    }
    return { success: true, multiDim }
}
