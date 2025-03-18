import { JsonError } from "@ourworldindata/types"
import e, { Request, Response } from "express"
import * as db from "../../db/db.js"
import {
    DbPlainExplorer,
    ExplorersTableName,
    upsertExplorer,
    getExplorerBySlug,
} from "../../db/model/Explorer.js"
import { triggerStaticBuild } from "./routeUtils.js"

// GET /allExplorers.json - List all explorers
export async function handleGetExplorers(
    _req: Request,
    _res: Response,
    trx: db.KnexReadonlyTransaction
) {
    // TODO: redirect allExplorers.json here
    console.log("Handled by /allExplorers.json")
}

export async function handleGetExplorer(
    req: Request,
    res: Response,
    trx: db.KnexReadonlyTransaction
) {
    const { slug } = req.params
    const explorer = await getExplorerBySlug(trx, slug)
    if (!explorer) {
        throw new JsonError("Explorer not found", 404)
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

// TODO: do we need PATCH?
export async function handlePatchExplorer(
    req: Request,
    res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadWriteTransaction
) {
    const { id } = req.params
    const explorerId = parseInt(id, 10)

    if (isNaN(explorerId)) {
        throw new JsonError("Invalid explorer ID")
    }

    const { published, slug } = req.body

    // // Validate slug if provided
    // if (slug !== undefined) {
    //     await validateNewGrapherSlug(trx, slug, explorerId)
    // }

    // Build update object
    const updateData: any = {}
    if (slug !== undefined) updateData.slug = slug
    if (published !== undefined) updateData.published = published

    if (Object.keys(updateData).length === 0) {
        throw new JsonError("No valid properties to update")
    }

    // Update explorer
    await trx<DbPlainExplorer>(ExplorersTableName)
        .where({ id: explorerId })
        .update({
            ...updateData,
            updatedAt: new Date(),
        })

    // Get updated explorer
    const updatedExplorer = await trx<DbPlainExplorer>(ExplorersTableName)
        .where({ id: explorerId })
        .first()

    if (!updatedExplorer) {
        throw new JsonError("Explorer not found", 404)
    }

    return {
        success: true,
        explorer: {
            ...updatedExplorer,
            config: JSON.parse(updatedExplorer.config),
        },
    }
}
