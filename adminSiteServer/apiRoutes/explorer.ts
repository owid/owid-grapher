import { JsonError, DbPlainUser } from "@ourworldindata/types"
import e, { Request, Response } from "express"

import { isValidSlug } from "../../serverUtils/serverUtil.js"

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
    if (!isValidSlug(slug)) {
        throw new JsonError(`Invalid explorer slug ${slug}`)
    }
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
    if (!isValidSlug(slug)) {
        throw new JsonError(`Invalid explorer slug ${slug}`)
    }
    await trx.table("explorer_tags").where({ explorerSlug: slug }).delete()
    return { success: true }
}

export async function handleGetExplorer(
    req: Request,
    res: Response,
    trx: db.KnexReadonlyTransaction
) {
    const { slug } = req.params
    if (!isValidSlug(slug)) {
        throw new JsonError(`Invalid explorer slug ${slug}`)
    }
    const explorer = await getExplorerBySlug(trx, slug)
    if (!explorer) {
        throw new JsonError(`Explorer not found: ${slug}`, 404)
    }
    return explorer
}

export async function handlePutExplorer(
    req: Request,
    res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadWriteTransaction
) {
    const { slug } = req.params
    if (!isValidSlug(slug)) {
        throw new JsonError(`Invalid explorer slug ${slug}`)
    }

    const user: DbPlainUser = res.locals.user

    const { tsv, commitMessage } = req.body

    await upsertExplorer(trx, slug, tsv, user.id, commitMessage)

    const isPublished = (await getExplorerBySlug(trx, slug))!.isPublished

    if (isPublished) {
        await triggerStaticBuild(user, `Publishing explorer ${slug}`)
    }
    return { success: true }
}

export async function handleDeleteExplorer(
    req: Request,
    res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadWriteTransaction
) {
    const { slug } = req.params
    if (!isValidSlug(slug)) {
        throw new JsonError(`Invalid explorer slug ${slug}`)
    }

    const user: DbPlainUser = res.locals.user

    const explorer = await getExplorerBySlug(trx, slug)
    if (!explorer) {
        throw new JsonError("Explorer not found", 404)
    }

    await trx(ExplorersTableName).where({ slug }).delete()

    if (explorer.isPublished) {
        await triggerStaticBuild(user, `Unpublishing explorer ${slug}`)
    }

    return { success: true }
}
