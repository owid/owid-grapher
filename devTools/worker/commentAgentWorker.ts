#!/usr/bin/env node

import { CommentAgentJobPayload, DbPlainJob } from "@ourworldindata/types"

import yargs from "yargs"
import { hideBin } from "yargs/helpers"

import { knexReadWriteTransaction } from "../../db/db.js"
import { claimNextQueuedJob, markJobFailed } from "../../db/model/Jobs.js"
import { processCommentAgentJob } from "../../jobQueue/commentAgentProcessor.js"
import { logErrorAndMaybeCaptureInSentry } from "../../serverUtils/errorLog.js"

const POLL_INTERVAL_MS = 2000

async function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Returns whether a job was processed, so the caller knows to keep going */
async function processJob(): Promise<boolean> {
    let currentJob: DbPlainJob<CommentAgentJobPayload> | null = null

    try {
        const job = await knexReadWriteTransaction(async (trx) =>
            claimNextQueuedJob<CommentAgentJobPayload>(
                trx,
                "comment_agent_request"
            )
        )
        if (!job) return false

        currentJob = job
        await processCommentAgentJob(job)
        console.log(
            `[${new Date().toISOString()}] Comment agent job ${job.id} completed`
        )
        return true
    } catch (error) {
        console.error(
            `[${new Date().toISOString()}] Error processing comment agent job:`,
            error
        )
        void logErrorAndMaybeCaptureInSentry(
            error instanceof Error ? error : new Error(String(error))
        )

        // A job left claimed would sit in "running" for ever and never retry,
        // so record the failure on the row even when the processor blew up.
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
            } catch (fallbackError) {
                console.error(
                    `[${new Date().toISOString()}] Failed to mark job ${currentJob.id} as failed:`,
                    fallbackError
                )
            }
        }
        return true
    }
}

async function loop(): Promise<void> {
    console.log(
        `[${new Date().toISOString()}] Comment agent worker (loop mode) started, polling every ${POLL_INTERVAL_MS}ms`
    )

    let running = true
    for (const signal of ["SIGINT", "SIGTERM"] as const) {
        process.on(signal, () => {
            console.log(
                `[${new Date().toISOString()}] ${signal} received, finishing the current job then exiting`
            )
            running = false
        })
    }

    while (running) {
        // Only sleep when the queue is empty, so a backlog drains promptly
        const didWork = await processJob()
        if (!didWork) await sleep(POLL_INTERVAL_MS)
    }
}

// Same interface as the explorer worker, so the pm2 invocation that runs it is
// the same shape: single job and exit by default, --loop to keep going.
const argv = yargs(hideBin(process.argv))
    .option("loop", {
        type: "boolean",
        default: false,
        describe:
            "Run in continuous loop mode (default: process one job and exit)",
    })
    .parseSync()

const run = argv.loop ? loop() : processJob().then(() => undefined)

run.then(
    () => process.exit(0),
    (error) => {
        console.error(
            `[${new Date().toISOString()}] Fatal error in comment agent worker:`,
            error
        )
        void logErrorAndMaybeCaptureInSentry(
            error instanceof Error ? error : new Error(String(error))
        )
        process.exit(1)
    }
)
