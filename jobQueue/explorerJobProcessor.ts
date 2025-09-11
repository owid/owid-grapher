import {
    claimNextQueuedJob,
    markJobDone,
    markJobFailed,
    requeueJob,
    updateExplorerRefreshStatus,
    isJobStillRunning,
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

export const MAX_ATTEMPTS = 3
const CONCURRENCY = 20

async function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

export function backoffDelay(attempts: number): number {
    // Exponential backoff: 5s, 15s, 45s
    return 5000 * Math.pow(3, attempts - 1)
}

export interface JobResult {
    success: boolean
    shouldRetry: boolean
    retryDelayMs?: number
}

export interface ProcessExplorerJobOptions {
    sleep?: (ms: number) => Promise<void>
    now?: () => Date
    maxAttempts?: number
    onAfterPhase1?: (job: DbPlainJob) => Promise<void>
}

export async function processExplorerViewsJob(
    job: DbPlainJob,
    opts: ProcessExplorerJobOptions = {}
): Promise<JobResult> {
    const { slug, explorerUpdatedAt } = job.payload

    let refreshResult: ExplorerViewsRefreshResult | undefined
    let isPublished: boolean = false

    const getNow = opts.now ?? (() => new Date())
    const maxAttempts = opts.maxAttempts ?? MAX_ATTEMPTS

    try {
        // Phase 1: DB operations in a single transaction
        const shouldContinue = await knexReadWriteTransaction(async (trx) => {
            // Check if explorer still exists and get current state
            const current = await trx("explorers")
                .where({ slug })
                .first(["lastEditedAt", "isPublished"])

            if (!current) {
                console.warn(
                    `Explorer ${slug} no longer exists, marking job as done`
                )
                await markJobDone(trx, job.id, "explorer missing")
                return false
            }

            isPublished = current.isPublished

            // Coalescing/staleness check: if current lastEditedAt is newer than job's snapshot, skip
            if (
                current.lastEditedAt &&
                current.lastEditedAt > explorerUpdatedAt
            ) {
                console.warn(
                    `Explorer ${slug} has been updated since job was queued (${current.lastEditedAt} > ${explorerUpdatedAt}), marking as done`
                )
                await markJobDone(trx, job.id, "superseded by newer update")
                return false
            }

            // Set explorer status to "refreshing"
            await updateExplorerRefreshStatus(trx, slug, "refreshing")

            // Perform DB-only refresh operations
            refreshResult = await refreshExplorerViewsForSlug(trx, slug)

            return true
        })

        // If we got here without refreshResult, the job was marked done early
        if (!shouldContinue || !refreshResult) {
            return { success: true, shouldRetry: false }
        }

        // Allow tests to mutate state after phase 1 to simulate races/staleness
        if (opts.onAfterPhase1) {
            await opts.onAfterPhase1(job)
        }

        // Check if job is still running before proceeding to R2 operations
        const stillRunning = await knexReadWriteTransaction(async (trx) => {
            return await isJobStillRunning(trx, job.id)
        })

        if (!stillRunning) {
            return { success: true, shouldRetry: false } // Job was superseded, abort
        }

        // Phase 2: R2 sync operations (outside any transaction)

        // Late-phase staleness check: re-verify job hasn't been superseded before R2 sync
        const isStale = await knexReadonlyTransaction(async (knex) => {
            const current = await knex("explorers")
                .where({ slug })
                .first(["lastEditedAt"])

            if (!current) {
                return true // Explorer was deleted, consider stale
            }

            return (
                current.lastEditedAt && current.lastEditedAt > explorerUpdatedAt
            )
        })

        if (isStale) {
            await knexReadWriteTransaction(async (trx) => {
                await markJobDone(
                    trx,
                    job.id,
                    "superseded by newer update before R2 sync"
                )
            })
            return { success: true, shouldRetry: false }
        }

        // Delete removed configs from R2 in parallel
        if (refreshResult!.removedChartConfigIds.length > 0) {
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
        const finalResult = await knexReadWriteTransaction(async (trx) => {
            // Final check if job is still running before marking as done
            const stillRunning = await isJobStillRunning(trx, job.id)
            if (!stillRunning) {
                return false // Job was superseded
            }

            // Final staleness check: re-verify job hasn't been superseded before completion
            const current = await trx("explorers")
                .where({ slug })
                .first(["lastEditedAt"])

            if (
                !current ||
                (current.lastEditedAt &&
                    current.lastEditedAt > explorerUpdatedAt)
            ) {
                await markJobDone(
                    trx,
                    job.id,
                    "superseded by newer update before completion"
                )
                return false // Job was superseded
            }

            await updateExplorerRefreshStatus(trx, slug, "clean", getNow())
            await markJobDone(trx, job.id)

            // Trigger static build if explorer is published
            if (isPublished) {
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

            return true // Success
        })

        if (!finalResult) {
            return { success: true, shouldRetry: false } // Job was superseded, abort
        }

        return { success: true, shouldRetry: false }
    } catch (error) {
        console.error(
            `[${new Date().toISOString()}] Error processing job ${job.id} for explorer ${slug}:`,
            error
        )

        // Handle job failure in a new transaction
        const retryInfo = await knexReadWriteTransaction(async (trx) => {
            const attempts = job.attempts + 1

            if (attempts < maxAttempts) {
                console.warn(
                    `Requeueing job ${job.id} for explorer ${slug} (attempt ${attempts}/${maxAttempts})`
                )
                await requeueJob(trx, job.id, attempts)
                await updateExplorerRefreshStatus(trx, slug, "queued")

                const delayMs = backoffDelay(attempts)
                console.warn(`Should retry after ${delayMs}ms backoff`)
                return { shouldRetry: true, delayMs }
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
                return { shouldRetry: false, delayMs: 0 }
            }
        })

        return {
            success: false,
            shouldRetry: retryInfo.shouldRetry,
            retryDelayMs: retryInfo.delayMs,
        }
    }
}

export async function processOneExplorerViewsJob(): Promise<boolean> {
    try {
        const job = await knexReadWriteTransaction(async (trx) => {
            return await claimNextQueuedJob(trx, "refresh_explorer_views")
        })

        if (!job) {
            return false // No jobs available
        }

        const result = await processExplorerViewsJob(job)

        // Handle retry logic here in the caller
        if (!result.success && result.shouldRetry && result.retryDelayMs) {
            await sleep(result.retryDelayMs)
        }

        return true // Job processed (whether successful or failed)
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
