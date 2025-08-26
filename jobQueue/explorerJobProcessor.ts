import {
    claimNextQueuedJob,
    markJobDone,
    markJobFailed,
    requeueJob,
    updateExplorerRefreshStatus,
} from "../db/model/Jobs.js"
import {
    refreshExplorerViewsForSlug,
    ExplorerViewsRefreshResult,
} from "../db/model/ExplorerViews.js"
import { knexReadWriteTransaction, knexReadonlyTransaction } from "../db/db.js"
import {
    saveGrapherConfigToR2ByUUID,
    deleteGrapherConfigFromR2ByUUID,
} from "../serverUtils/r2/chartConfigR2Helpers.js"
import { triggerStaticBuild } from "../baker/GrapherBakingUtils.js"
import { logErrorAndMaybeCaptureInSentry } from "../serverUtils/errorLog.js"
import pMap from "p-map"
import { DbPlainJob } from "@ourworldindata/types"
import { hostname } from "os"

const MAX_ATTEMPTS = 3
const CONCURRENCY = 20
const LOCK_ID = `${hostname()}-${process.pid}-${Date.now()}`

async function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

function backoffDelay(attempts: number): number {
    // Exponential backoff: 5s, 15s, 45s
    return 5000 * Math.pow(3, attempts - 1)
}

export async function processExplorerViewsJob(job: DbPlainJob): Promise<void> {
    const { slug, explorerUpdatedAt } = job

    console.warn(
        `[${new Date().toISOString()}] Processing job ${job.id} for explorer: ${slug}`
    )

    let refreshResult: ExplorerViewsRefreshResult | undefined
    let isPublished: boolean

    try {
        // Phase 1: DB operations in a single transaction
        await knexReadWriteTransaction(async (trx) => {
            // Check if explorer still exists and get current state
            const current = await trx("explorers")
                .where({ slug })
                .first(["updatedAt", "isPublished"])

            if (!current) {
                console.warn(
                    `Explorer ${slug} no longer exists, marking job as done`
                )
                await markJobDone(trx, job.id, "explorer missing")
                return
            }

            isPublished = current.isPublished

            // Coalescing/staleness check: if current updatedAt is newer than job's snapshot, skip
            if (current.updatedAt > explorerUpdatedAt) {
                console.warn(
                    `Explorer ${slug} has been updated since job was queued (${current.updatedAt} > ${explorerUpdatedAt}), marking as done`
                )
                await markJobDone(trx, job.id, "superseded by newer update")
                return
            }

            // Set explorer status to "refreshing"
            await updateExplorerRefreshStatus(trx, slug, "refreshing")

            // Perform DB-only refresh operations
            console.warn(`Refreshing explorer views for ${slug} (DB phase)`)
            refreshResult = await refreshExplorerViewsForSlug(trx, slug)

            console.warn(`Explorer ${slug} refresh result:`, {
                updated: refreshResult.updatedChartConfigIds.length,
                unchanged: refreshResult.unchangedChartConfigIds.length,
                removed: refreshResult.removedChartConfigIds.length,
            })
        })

        // If we got here without refreshResult, the job was marked done early
        if (!refreshResult) {
            return
        }

        // Phase 2: R2 sync operations (outside any transaction)
        console.warn(`Syncing R2 configs for explorer ${slug}`)

        // Delete removed configs from R2 in parallel
        if (refreshResult!.removedChartConfigIds.length > 0) {
            console.warn(
                `Deleting ${refreshResult!.removedChartConfigIds.length} removed configs from R2`
            )
            await pMap(
                refreshResult!.removedChartConfigIds,
                async (configId) => {
                    await deleteGrapherConfigFromR2ByUUID(configId)
                },
                { concurrency: CONCURRENCY }
            )
        }

        // Upsert updated configs to R2 in parallel
        if (refreshResult!.updatedChartConfigIds.length > 0) {
            console.warn(
                `Uploading ${refreshResult!.updatedChartConfigIds.length} updated configs to R2`
            )

            // Fetch chart configs (simple read, no transaction needed)
            const chartConfigs = await knexReadonlyTransaction(async (knex) => {
                return await knex("chart_configs")
                    .select("id", "full", "fullMd5")
                    .whereIn("id", refreshResult!.updatedChartConfigIds)
            })

            await pMap(
                chartConfigs,
                async (config) => {
                    await saveGrapherConfigToR2ByUUID(
                        config.id,
                        config.full,
                        config.fullMd5
                    )
                },
                { concurrency: CONCURRENCY }
            )
        }

        // Phase 3: Final success state update in a new transaction
        await knexReadWriteTransaction(async (trx) => {
            await updateExplorerRefreshStatus(trx, slug, "clean", new Date())
            await markJobDone(trx, job.id)

            // Trigger static build if explorer is published
            if (isPublished) {
                console.warn(
                    `Triggering static build for published explorer: ${slug}`
                )
                // Get the user who last edited this explorer for the build trigger
                const explorerWithUser = await trx("explorers")
                    .join("users", "explorers.lastEditedByUserId", "users.id")
                    .select("users.id", "users.fullName", "users.email")
                    .where("explorers.slug", slug)
                    .first()

                if (explorerWithUser) {
                    await triggerStaticBuild(
                        explorerWithUser,
                        `Publishing explorer ${slug}`
                    )
                } else {
                    console.warn(
                        `Could not find user for explorer ${slug}, skipping static build`
                    )
                }
            }
        })

        console.warn(
            `[${new Date().toISOString()}] Successfully completed job ${job.id} for explorer: ${slug}`
        )
    } catch (error) {
        console.error(
            `[${new Date().toISOString()}] Error processing job ${job.id} for explorer ${slug}:`,
            error
        )

        // Handle job failure in a new transaction
        let shouldApplyBackoff = false
        let delayMs = 0

        await knexReadWriteTransaction(async (trx) => {
            const attempts = job.attempts + 1

            if (attempts < MAX_ATTEMPTS) {
                console.warn(
                    `Requeueing job ${job.id} for explorer ${slug} (attempt ${attempts}/${MAX_ATTEMPTS})`
                )
                await requeueJob(trx, job.id, attempts)
                await updateExplorerRefreshStatus(trx, slug, "queued")

                // Prepare for backoff delay after transaction completes
                shouldApplyBackoff = true
                delayMs = backoffDelay(attempts)
                console.warn(`Will retry after ${delayMs}ms backoff`)
            } else {
                console.warn(
                    `Job ${job.id} for explorer ${slug} has exceeded max attempts, marking as failed`
                )
                await markJobFailed(
                    trx,
                    job.id,
                    error instanceof Error ? error : new Error(String(error))
                )
                await updateExplorerRefreshStatus(trx, slug, "failed")
            }
        })

        // Apply backoff delay outside of transaction
        if (shouldApplyBackoff) {
            await sleep(delayMs)
        }

        // Re-throw to be caught by the main loop
        throw error
    }
}

export async function processOneExplorerViewsJob(): Promise<boolean> {
    try {
        const job = await knexReadWriteTransaction(async (trx) => {
            return await claimNextQueuedJob(trx, "refresh_explorer_views", {
                lockId: LOCK_ID,
            })
        })

        if (!job) {
            return false // No jobs available
        }

        await processExplorerViewsJob(job)
        return true // Job processed
    } catch (error) {
        console.error(
            `[${new Date().toISOString()}] Error processing single job:`,
            error
        )
        void logErrorAndMaybeCaptureInSentry(
            error instanceof Error ? error : new Error(String(error))
        )
        throw error
    }
}
