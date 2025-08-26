#!/usr/bin/env node

import {
    claimNextQueuedJob,
    markJobDone,
    markJobFailed,
    requeueJob,
    updateExplorerRefreshStatus,
} from "../../db/model/Jobs.js"
import { refreshExplorerViewsForSlug } from "../../db/model/ExplorerViews.js"
import { knexReadWriteTransaction } from "../../db/db.js"
import {
    saveGrapherConfigToR2ByUUID,
    deleteGrapherConfigFromR2ByUUID,
} from "../../adminSiteServer/R2/chartConfigR2Helpers.js"
import { triggerStaticBuild } from "../../adminSiteServer/apiRoutes/routeUtils.js"
import { logErrorAndMaybeCaptureInSentry } from "../../serverUtils/errorLog.js"
import pMap from "p-map"
import { DbPlainJob } from "@ourworldindata/types"
import { hostname } from "os"

const MAX_ATTEMPTS = 3
const CONCURRENCY = 20
const POLL_INTERVAL_MS = 2000
const LOCK_ID = `${hostname()}-${process.pid}-${Date.now()}`

async function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

function backoffDelay(attempts: number): number {
    // Exponential backoff: 5s, 15s, 45s
    return 5000 * Math.pow(3, attempts - 1)
}

async function processRefreshExplorerViewsJob(job: DbPlainJob): Promise<void> {
    const { slug, explorerUpdatedAt } = job

    console.log(
        `[${new Date().toISOString()}] Processing job ${job.id} for explorer: ${slug}`
    )

    let refreshResult: any
    let isPublished: boolean

    try {
        // Phase 1: DB operations in a single transaction
        await knexReadWriteTransaction(async (trx) => {
            // Check if explorer still exists and get current state
            const current = await trx("explorers")
                .where({ slug })
                .first(["updatedAt", "isPublished"])

            if (!current) {
                console.log(
                    `Explorer ${slug} no longer exists, marking job as done`
                )
                await markJobDone(trx, job.id, "explorer missing")
                return
            }

            isPublished = current.isPublished

            // Coalescing/staleness check: if current updatedAt is newer than job's snapshot, skip
            if (current.updatedAt > explorerUpdatedAt) {
                console.log(
                    `Explorer ${slug} has been updated since job was queued (${current.updatedAt} > ${explorerUpdatedAt}), marking as done`
                )
                await markJobDone(trx, job.id, "superseded by newer update")
                return
            }

            // Set explorer status to "refreshing"
            await updateExplorerRefreshStatus(trx, slug, "refreshing")

            // Perform DB-only refresh operations
            console.log(`Refreshing explorer views for ${slug} (DB phase)`)
            refreshResult = await refreshExplorerViewsForSlug(trx, slug)

            console.log(`Explorer ${slug} refresh result:`, {
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
        console.log(`Syncing R2 configs for explorer ${slug}`)

        // Delete removed configs from R2 in parallel
        if (refreshResult.removedChartConfigIds.length > 0) {
            console.log(
                `Deleting ${refreshResult.removedChartConfigIds.length} removed configs from R2`
            )
            await pMap(
                refreshResult.removedChartConfigIds,
                async (configId) => {
                    try {
                        await deleteGrapherConfigFromR2ByUUID(configId)
                    } catch (error) {
                        console.error(
                            `Failed to delete config ${configId} from R2:`,
                            error
                        )
                        void logErrorAndMaybeCaptureInSentry(
                            new Error(
                                `Failed to delete explorer view chart config ${configId} from R2: ${error instanceof Error ? error.message : String(error)}`
                            )
                        )
                    }
                },
                { concurrency: CONCURRENCY }
            )
        }

        // Upsert updated configs to R2 in parallel
        if (refreshResult.updatedChartConfigIds.length > 0) {
            console.log(
                `Uploading ${refreshResult.updatedChartConfigIds.length} updated configs to R2`
            )

            // Fetch chart configs in a separate read-only transaction
            const chartConfigs = await knexReadWriteTransaction(async (trx) => {
                return await trx("chart_configs")
                    .select("id", "full", "fullMd5")
                    .whereIn("id", refreshResult.updatedChartConfigIds)
            })

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
                        console.error(
                            `Failed to sync config ${config.id} to R2:`,
                            error
                        )
                        void logErrorAndMaybeCaptureInSentry(
                            new Error(
                                `Failed to sync explorer view chart config ${config.id} to R2: ${error instanceof Error ? error.message : String(error)}`
                            )
                        )
                    }
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
                console.log(
                    `Triggering static build for published explorer: ${slug}`
                )
                // Note: We would need a system user here. For now, we'll create a minimal user object
                const systemUser = {
                    id: 1,
                    fullName: "System",
                    email: "system@ourworldindata.org",
                }
                await triggerStaticBuild(
                    systemUser,
                    `Publishing explorer ${slug}`
                )
            }
        })

        console.log(
            `[${new Date().toISOString()}] Successfully completed job ${job.id} for explorer: ${slug}`
        )
    } catch (error) {
        console.error(
            `[${new Date().toISOString()}] Error processing job ${job.id} for explorer ${slug}:`,
            error
        )

        // Handle job failure in a new transaction
        await knexReadWriteTransaction(async (trx) => {
            const attempts = job.attempts + 1

            if (attempts < MAX_ATTEMPTS) {
                console.log(
                    `Requeueing job ${job.id} for explorer ${slug} (attempt ${attempts}/${MAX_ATTEMPTS})`
                )
                await requeueJob(trx, job.id, attempts)
                await updateExplorerRefreshStatus(trx, slug, "queued")

                // Apply backoff delay before the job will be picked up again
                const delay = backoffDelay(attempts)
                console.log(`Will retry after ${delay}ms backoff`)
                await sleep(delay)
            } else {
                console.log(
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

        // Re-throw to be caught by the main loop
        throw error
    }
}

async function workerLoop(): Promise<void> {
    console.log(
        `[${new Date().toISOString()}] Explorer jobs worker started with lock ID: ${LOCK_ID}`
    )
    console.log(`Worker configuration:`)
    console.log(`  - Max attempts: ${MAX_ATTEMPTS}`)
    console.log(`  - Concurrency: ${CONCURRENCY}`)
    console.log(`  - Poll interval: ${POLL_INTERVAL_MS}ms`)

    while (true) {
        try {
            const job = await knexReadWriteTransaction(async (trx) => {
                return await claimNextQueuedJob(trx, "refresh_explorer_views", {
                    lockId: LOCK_ID,
                })
            })

            if (!job) {
                // No jobs available, sleep and continue
                await sleep(POLL_INTERVAL_MS)
                continue
            }

            try {
                await processRefreshExplorerViewsJob(job)
            } catch (error) {
                console.error(
                    `[${new Date().toISOString()}] Failed to process job ${job.id}:`,
                    error
                )
                // Job failure handling is done within processRefreshExplorerViewsJob
            }
        } catch (error) {
            console.error(
                `[${new Date().toISOString()}] Error in worker loop:`,
                error
            )
            void logErrorAndMaybeCaptureInSentry(
                error instanceof Error ? error : new Error(String(error))
            )

            // Sleep a bit before retrying to avoid tight error loops
            await sleep(5000)
        }
    }
}

// Handle graceful shutdown
process.on("SIGINT", () => {
    console.log(
        `[${new Date().toISOString()}] Received SIGINT, shutting down gracefully...`
    )
    process.exit(0)
})

process.on("SIGTERM", () => {
    console.log(
        `[${new Date().toISOString()}] Received SIGTERM, shutting down gracefully...`
    )
    process.exit(0)
})

// Start the worker
if (require.main === module) {
    workerLoop().catch((error) => {
        console.error(
            `[${new Date().toISOString()}] Fatal error in worker:`,
            error
        )
        void logErrorAndMaybeCaptureInSentry(
            error instanceof Error ? error : new Error(String(error))
        )
        process.exit(1)
    })
}
