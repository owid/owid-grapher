import {
    JsonError,
    DbPlainUser,
    ExplorersTableName,
} from "@ourworldindata/types"
import e, { Request, Response } from "express"

import { isValidSlug } from "../../serverUtils/serverUtil.js"

import * as db from "../../db/db.js"

import { upsertExplorer, getExplorerBySlug } from "../../db/model/Explorer.js"
import { triggerStaticBuild } from "./routeUtils.js"
import {
    saveGrapherConfigToR2ByUUID,
    deleteGrapherConfigFromR2ByUUID,
} from "../chartConfigR2Helpers.js"
import { logErrorAndMaybeCaptureInSentry } from "../../serverUtils/errorLog.js"
import pMap from "p-map"

function validateExplorerSlug(slug: string): void {
    if (!isValidSlug(slug)) {
        throw new JsonError(`Invalid explorer slug ${slug}`)
    }
}

export async function addExplorerTags(
    req: Request,
    _res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadonlyTransaction
) {
    const { slug } = req.params
    const { tagIds } = req.body

    validateExplorerSlug(slug)

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
    validateExplorerSlug(slug)
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
    validateExplorerSlug(slug)

    const user: DbPlainUser = res.locals.user

    const { tsv, commitMessage } = req.body

    const { refreshResult } = await upsertExplorer(trx, {
        slug,
        tsv,
        lastEditedByUserId: user.id,
        commitMessage,
    })

    // Remove obsolete chart configs from R2
    if (refreshResult.removedChartConfigIds.length > 0) {
        // Delete from R2 in parallel with limited concurrency
        await pMap(
            refreshResult.removedChartConfigIds,
            async (configId) => {
                try {
                    await deleteGrapherConfigFromR2ByUUID(configId)
                } catch (error) {
                    void logErrorAndMaybeCaptureInSentry(
                        new Error(
                            `Failed to delete explorer view chart config ${configId} from R2: ${error instanceof Error ? error.message : String(error)}`
                        )
                    )
                }
            },
            { concurrency: 20 }
        )
    }

    // Sync updated chart configs to R2
    if (refreshResult.updatedChartConfigIds.length > 0) {
        // Batch fetch chart configs for R2 sync
        const chartConfigs = await trx("chart_configs")
            .select("id", "full", "fullMd5")
            .whereIn("id", refreshResult.updatedChartConfigIds)

        // Sync to R2 in parallel with limited concurrency using pMap
        await pMap(
            chartConfigs,
            async (config) => {
                try {
                    await saveGrapherConfigToR2ByUUID(
                        config.id,
                        config.full,
                        config.fullMd5
                    )
                } catch (error) {
                    void logErrorAndMaybeCaptureInSentry(
                        new Error(
                            `Failed to sync explorer view chart config ${config.id} to R2: ${error instanceof Error ? error.message : String(error)}`
                        )
                    )
                }
            },
            { concurrency: 20 }
        )
    }

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
    validateExplorerSlug(slug)

    const user: DbPlainUser = res.locals.user

    const explorer = await getExplorerBySlug(trx, slug)
    if (!explorer) {
        throw new JsonError("Explorer not found", 404)
    }

    // Get chart config IDs from explorer views before deletion
    const explorerViewChartConfigs = await trx("explorer_views")
        .select("chartConfigId")
        .where({ explorerSlug: slug })
        .whereNotNull("chartConfigId")

    const chartConfigIds = explorerViewChartConfigs.map(
        (row) => row.chartConfigId
    )

    await trx(ExplorersTableName).where({ slug }).delete()

    // Note: explorer_views are automatically cleaned up via ON DELETE CASCADE
    // foreign key constraint from explorerSlug to explorers.slug

    // Explicitly clean up chart configs that were created for explorer views
    // (CASCADE constraint should handle this, but explicitly doing it to ensure cleanup)
    if (chartConfigIds.length > 0) {
        await trx("chart_configs").whereIn("id", chartConfigIds).delete()
    }

    if (explorer.isPublished) {
        await triggerStaticBuild(user, `Unpublishing explorer ${slug}`)
    }

    return { success: true }
}
