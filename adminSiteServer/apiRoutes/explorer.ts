import { JsonError } from "@ourworldindata/types"
import { Request } from "express"
import * as e from "express"

import * as db from "../../db/db.js"

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

export async function getExplorerBySlug(
    req: Request,
    _res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadonlyTransaction
) {
    const { slug } = req.params
    const explorer = await trx.table("explorers").where({ slug }).first()
    if (!explorer)
        throw new JsonError(`No explorer found for slug ${slug}`, 404)

    return explorer
}
