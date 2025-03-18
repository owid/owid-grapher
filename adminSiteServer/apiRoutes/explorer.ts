import { JsonError } from "@ourworldindata/types"
import e, { Request, Response } from "express"

import * as db from "../../db/db.js"

import {
    ExplorersTableName,
    upsertExplorer,
    getExplorerBySlug,
} from "../../db/model/Explorer.js"
import { triggerStaticBuild } from "./routeUtils.js"

export async function addExplorerTags(
    req: Request,
    _res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadonlyTransaction
) {
    const { slug } = req.params
    const { tagIds } = req.body
    const explorer = await trx.table("explorers").where({ slug }).first()
    if (!explorer)
        throw new JsonError(`No explorer found for slug ${slug}`, 404)

    await trx.table("explorer_tags").where({ explorerSlug: slug }).delete()
    for (const tagId of tagIds) {
        await trx.table("explorer_tags").insert({ explorerSlug: slug, tagId })
    }

    return { success: true }
}

export async function deleteExplorerTags(
    req: Request,
    _res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadonlyTransaction
) {
    const { slug } = req.params
    await trx.table("explorer_tags").where({ explorerSlug: slug }).delete()
    return { success: true }
}

export async function handleGetExplorer(
    req: Request,
    res: Response,
    trx: db.KnexReadonlyTransaction
) {
    const { slug } = req.params
    const explorer = await getExplorerBySlug(trx, slug)
    if (!explorer) {
        return {}
    }
    return explorer
}

// PUT /explorers/:slug - Save or update explorer by slug
export async function handlePutExplorer(
    req: Request,
    res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadWriteTransaction
) {
    const { slug } = req.params
    if (!slug) {
        throw new JsonError(`Invalid explorer slug ${slug}`)
    }

    const { tsv: tsv } = req.body as { tsv: any }
    const id = await upsertExplorer(trx, slug, tsv)

    const { slug: publishedSlug } =
        (await trx(ExplorersTableName)
            .select("slug")
            .where("slug", slug)
            .where("isPublished", true)
            .first()) ?? {}
    if (publishedSlug) {
        await triggerStaticBuild(
            res.locals.user,
            `Publishing multidimensional chart ${publishedSlug}`
        )
    }
    return { success: true, id }
}

export async function handleDeleteExplorer(
    req: Request,
    res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadWriteTransaction
) {
    const { slug } = req.params
    if (!slug) {
        throw new JsonError("Invalid explorer slug " + slug)
    }

    const explorer = await getExplorerBySlug(trx, slug)
    if (!explorer) {
        throw new JsonError("Explorer not found", 404)
    }

    await trx(ExplorersTableName).where({ slug }).delete()

    return { success: true }
}
