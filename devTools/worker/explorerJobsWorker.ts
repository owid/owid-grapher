#!/usr/bin/env node

import {
    processExplorerViewsJob,
    processOneExplorerViewsJob,
} from "../../jobQueue/explorerJobProcessor.js"
import { claimNextQueuedJob } from "../../db/model/Jobs.js"
import { knexReadWriteTransaction } from "../../db/db.js"
import { logErrorAndMaybeCaptureInSentry } from "../../serverUtils/errorLog.js"
import yargs from "yargs"
import { hideBin } from "yargs/helpers"

const POLL_INTERVAL_MS = 2000

async function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

async function processOneJobAndExit(): Promise<void> {
    console.log(
        `[${new Date().toISOString()}] Explorer jobs worker (single-run mode) started`
    )

    try {
        const job = await knexReadWriteTransaction(async (trx) => {
            return await claimNextQueuedJob(trx, "refresh_explorer_views")
        })

        if (!job) {
            console.log(
                `[${new Date().toISOString()}] No jobs available, exiting`
            )
            return
        }

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
                    `[${new Date().toISOString()}] Sleeping ${result.retryDelayMs}ms before allowing next job`
                )
                await sleep(result.retryDelayMs)
            }
        }
    } catch (error) {
        console.error(
            `[${new Date().toISOString()}] Error processing job:`,
            error
        )
        void logErrorAndMaybeCaptureInSentry(
            error instanceof Error ? error : new Error(String(error))
        )
        throw error
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
            const job = await knexReadWriteTransaction(async (trx) => {
                return await claimNextQueuedJob(trx, "refresh_explorer_views")
            })

            if (!job) {
                // No jobs available, sleep and continue
                await sleep(POLL_INTERVAL_MS)
                continue
            }

            const result = await processExplorerViewsJob(job)

            if (!result.success) {
                console.error(
                    `[${new Date().toISOString()}] Failed to process job ${job.id}`
                )

                // Handle retry logic here in the caller
                if (result.shouldRetry && result.retryDelayMs) {
                    console.log(
                        `[${new Date().toISOString()}] Sleeping ${result.retryDelayMs}ms before next poll`
                    )
                    await sleep(result.retryDelayMs)
                }
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
