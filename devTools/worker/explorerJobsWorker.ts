#!/usr/bin/env node

import {
    processExplorerViewsJob,
    processOneExplorerViewsJob,
} from "../../jobQueue/explorerJobProcessor.js"
import { claimNextQueuedJob, markJobFailed } from "../../db/model/Jobs.js"
import { DbPlainJob } from "@ourworldindata/types"
import { knexReadWriteTransaction } from "../../db/db.js"
import { logErrorAndMaybeCaptureInSentry } from "../../serverUtils/errorLog.js"
import yargs from "yargs"
import { hideBin } from "yargs/helpers"

const POLL_INTERVAL_MS = 2000

async function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

async function processJob(): Promise<boolean> {
    let currentJob: DbPlainJob | null = null

    try {
        const job = await knexReadWriteTransaction(async (trx) => {
            return await claimNextQueuedJob(trx, "refresh_explorer_views")
        })

        if (!job) {
            return false // No job available
        }

        currentJob = job
        const result = await processExplorerViewsJob(job)

        if (result.success) {
            console.log(
                `[${new Date().toISOString()}] Job ${job.id} completed successfully`
            )
        } else {
            console.error(`[${new Date().toISOString()}] Job ${job.id} failed`)

            // Handle retry logic here in the caller
            if (result.shouldRetry && result.retryDelayMs) {
                console.log(
                    `[${new Date().toISOString()}] Sleeping ${result.retryDelayMs}ms before next job`
                )
                await sleep(result.retryDelayMs)
            }
        }

        return true // Job processed
    } catch (error) {
        console.error(
            `[${new Date().toISOString()}] Error processing job:`,
            error
        )
        void logErrorAndMaybeCaptureInSentry(
            error instanceof Error ? error : new Error(String(error))
        )

        // If we have a job that was claimed but processExplorerViewsJob threw,
        // try to mark it as failed to prevent it from staying in "running" state
        if (currentJob) {
            try {
                await knexReadWriteTransaction(async (trx) => {
                    await markJobFailed(
                        trx,
                        currentJob!.id,
                        error instanceof Error
                            ? error
                            : new Error(String(error))
                    )
                })
                console.log(
                    `[${new Date().toISOString()}] Marked job ${currentJob!.id} as failed after worker error`
                )
            } catch (fallbackError) {
                console.error(
                    `[${new Date().toISOString()}] Failed to mark job ${currentJob!.id} as failed:`,
                    fallbackError
                )
                // Job will remain in "running" state, but we've logged the issue
            }
        }

        throw error
    }
}

async function processOneJobAndExit(): Promise<void> {
    console.log(
        `[${new Date().toISOString()}] Explorer jobs worker (single-run mode) started`
    )

    const jobProcessed = await processJob()

    if (!jobProcessed) {
        console.log(`[${new Date().toISOString()}] No jobs available, exiting`)
    }
}

async function workerLoop(): Promise<void> {
    console.log(
        `[${new Date().toISOString()}] Explorer jobs worker (loop mode) started`
    )
    console.log(`Worker configuration:`)
    console.log(`  - Poll interval: ${POLL_INTERVAL_MS}ms`)

    while (true) {
        try {
            const jobProcessed = await processJob()

            if (!jobProcessed) {
                // No jobs available, sleep and continue
                await sleep(POLL_INTERVAL_MS)
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

export async function processOneJob(): Promise<boolean> {
    return await processOneExplorerViewsJob()
}

// Parse command line arguments
const argv = yargs(hideBin(process.argv))
    .option("loop", {
        type: "boolean",
        default: false,
        description:
            "Run in continuous loop mode (default: process one job and exit)",
    })
    .help()
    .parseSync()

// Start the worker
if (require.main === module) {
    if (argv.loop) {
        // Continuous loop mode
        workerLoop().catch((error) => {
            console.error(
                `[${new Date().toISOString()}] Fatal error in worker loop:`,
                error
            )
            void logErrorAndMaybeCaptureInSentry(
                error instanceof Error ? error : new Error(String(error))
            )
            process.exit(1)
        })
    } else {
        // Single-run mode (default)
        processOneJobAndExit()
            .then(() => {
                console.log(
                    `[${new Date().toISOString()}] Single job processing completed, exiting`
                )
                process.exit(0)
            })
            .catch((error) => {
                console.error(
                    `[${new Date().toISOString()}] Fatal error processing job:`,
                    error
                )
                void logErrorAndMaybeCaptureInSentry(
                    error instanceof Error ? error : new Error(String(error))
                )
                process.exit(1)
            })
    }
}
