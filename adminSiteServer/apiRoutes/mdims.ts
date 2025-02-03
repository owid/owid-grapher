import {
    JsonError,
    MultiDimDataPageConfigRaw,
    MultiDimDataPagesTableName,
} from "@ourworldindata/types"
import {
    getMultiDimDataPageById,
    isMultiDimDataPagePublished,
} from "../../db/model/MultiDimDataPage.js"
import { expectInt, isValidSlug } from "../../serverUtils/serverUtil.js"
import {
    FEATURE_FLAGS,
    FeatureFlagFeature,
} from "../../settings/clientSettings.js"
import { createMultiDimConfig, setMultiDimPublished } from "../multiDim.js"
import { triggerStaticBuild } from "./routeUtils.js"
import { Request } from "../authentication.js"
import * as db from "../../db/db.js"
import e from "express"

export async function handleGetMultiDims(
    _req: Request,
    _res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadonlyTransaction
) {
    try {
        const results = await db.knexRaw<{
            id: number
            slug: string
            title: string
            updatedAt: string
            published: number
        }>(
            trx,
            `-- sql
            SELECT
                id,
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
    const { slug } = req.params
    if (!isValidSlug(slug)) {
        throw new JsonError(`Invalid multi-dim slug ${slug}`)
    }
    const rawConfig = req.body as MultiDimDataPageConfigRaw
    const id = await createMultiDimConfig(trx, slug, rawConfig)

    if (
        FEATURE_FLAGS.has(FeatureFlagFeature.MultiDimDataPage) &&
        (await isMultiDimDataPagePublished(trx, slug))
    ) {
        await triggerStaticBuild(
            res.locals.user,
            `Publishing multidimensional chart ${slug}`
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
    const multiDim = await getMultiDimDataPageById(trx, id)
    if (!multiDim) {
        throw new JsonError(`Multi-dimensional data page not found`, 404)
    }
    const { published } = req.body
    if (published !== undefined && published !== multiDim.published) {
        await setMultiDimPublished(trx, multiDim, published)
        await triggerStaticBuild(
            res.locals.user,
            `${published ? "Publishing" : "Unpublishing"} multidimensional chart ${multiDim.slug}`
        )
    }
    return { success: true }
}
