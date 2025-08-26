#!/usr/bin/env node

import {
    processExplorerViewsJob,
    processOneExplorerViewsJob,
} from "../../jobQueue/explorerJobProcessor.js"
import { claimNextQueuedJob } from "../../db/model/Jobs.js"
import { knexReadWriteTransaction } from "../../db/db.js"
import { logErrorAndMaybeCaptureInSentry } from "../../serverUtils/errorLog.js"
import { hostname } from "os"

const POLL_INTERVAL_MS = 2000
const LOCK_ID = `${hostname()}-${process.pid}-${Date.now()}`

async function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

async function workerLoop(): Promise<void> {
    console.log(
        `[${new Date().toISOString()}] Explorer jobs worker started with lock ID: ${LOCK_ID}`
    )
    console.log(`Worker configuration:`)
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
                await processExplorerViewsJob(job)
            } catch (error) {
                console.error(
                    `[${new Date().toISOString()}] Failed to process job ${job.id}:`,
                    error
                )
                // Job failure handling is done within processExplorerViewsJob
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
