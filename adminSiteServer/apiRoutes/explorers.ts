import { JsonError } from "@ourworldindata/types"
import { Request, Response } from "express"
import * as db from "../../db/db.js"
import {
    DbPlainExplorer,
    ExplorersTableName,
    upsertExplorer,
} from "../../db/model/Explorer.js"

// PUT /explorers/:slug - Save or update explorer by slug
export async function handlePutExplorer(
    req: Request,
    _res: Response,
    trx: db.KnexReadWriteTransaction
) {
    const { slug } = req.params
    if (!slug) {
        throw new JsonError(`Invalid explorer slug ${slug}`)
    }

    const { config: rawConfig } = req.body as { config: any }
    if (!rawConfig) {
        throw new JsonError("Explorer config is required")
    }

    const configStr = JSON.stringify(rawConfig)
    const id = await upsertExplorer(trx, slug, configStr)

    return { success: true, id }
}

// GET /allExplorers.json - List all explorers
export async function handleGetExplorers(
    _req: Request,
    _res: Response,
    trx: db.KnexReadonlyTransaction
) {
    console.log("Handled by /allExplorers.json")
}

// PATCH /explorers/:id - Update explorer properties
export async function handlePatchExplorer(
    req: Request,
    _res: Response,
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
