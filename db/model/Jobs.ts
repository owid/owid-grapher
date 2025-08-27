import { KnexReadWriteTransaction, knexRaw } from "../db.js"
import {
    DbInsertJob,
    DbPlainJob,
    JobsTableName,
    JobType,
} from "@ourworldindata/types"

interface JobClaimOptions {
    lockId: string
}

export async function enqueueJob(
    knex: KnexReadWriteTransaction,
    job: DbInsertJob
): Promise<void> {
    // Mark any existing queued jobs for this type and slug as done (superseded)
    await knexRaw(
        knex,
        `-- sql
            UPDATE jobs
            SET state = 'done', lastError = 'superseded by newer update'
            WHERE type = ? AND payload ->> '$.slug' = ? AND state = 'queued'
        `,
        [job.type, job.payload.slug]
    )

    // Insert the new job
    await knexRaw(
        knex,
        `-- sql
            INSERT INTO jobs (type, payload, state, attempts)
            VALUES (?, ?, 'queued', 0)
        `,
        [job.type, JSON.stringify(job.payload)]
    )
}

export async function claimNextQueuedJob(
    knex: KnexReadWriteTransaction,
    type: JobType,
    _options: JobClaimOptions
): Promise<DbPlainJob | null> {
    // First, find the next queued job
    const nextJob = await knex(JobsTableName)
        .where({ type, state: "queued" })
        .orderBy("id", "asc")
        .first()

    if (!nextJob) {
        return null
    }

    // Atomically claim it by updating its state
    const result = await knex.raw(
        `UPDATE jobs SET state = 'running' WHERE id = ? AND state = 'queued'`,
        [nextJob.id]
    )

    // Check if we successfully claimed it (someone else might have claimed it first)
    if (result[0].affectedRows === 0) {
        return null
    }

    // Return the claimed job with updated state
    const claimedJob = await knex(JobsTableName)
        .where({ id: nextJob.id })
        .first()

    if (!claimedJob) return null

    // Parse the JSON payload field
    if (typeof claimedJob.payload === "string") {
        claimedJob.payload = JSON.parse(claimedJob.payload)
    }

    return claimedJob
}

export async function markJobDone(
    knex: KnexReadWriteTransaction,
    jobId: number,
    message?: string
): Promise<void> {
    await knexRaw(
        knex,
        `-- sql
            UPDATE jobs
            SET state = 'done', lastError = ?
            WHERE id = ?
        `,
        [message || null, jobId]
    )
}

export async function markJobFailed(
    knex: KnexReadWriteTransaction,
    jobId: number,
    error: Error | string
): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : error

    await knexRaw(
        knex,
        `-- sql
            UPDATE jobs
            SET state = 'failed', lastError = ?
            WHERE id = ?
        `,
        [errorMessage.slice(0, 1000), jobId]
    )
}

export async function requeueJob(
    knex: KnexReadWriteTransaction,
    jobId: number,
    attempts: number
): Promise<void> {
    await knexRaw(
        knex,
        `-- sql
            UPDATE jobs
            SET state = 'queued', attempts = ?
            WHERE id = ?
        `,
        [attempts, jobId]
    )
}

export async function getJobBySlug(
    knex: KnexReadWriteTransaction,
    type: JobType,
    slug: string
): Promise<DbPlainJob | null> {
    const result = await knexRaw<DbPlainJob>(
        knex,
        `-- sql
            SELECT * FROM jobs 
            WHERE type = ? AND payload ->> '$.slug' = ?
            LIMIT 1
        `,
        [type, slug]
    )
    if (result.length === 0) return null

    // Parse the JSON payload field
    const job = result[0]
    if (typeof job.payload === "string") {
        job.payload = JSON.parse(job.payload)
    }

    return job
}

export async function isJobStillRunning(
    knex: KnexReadWriteTransaction,
    jobId: number
): Promise<boolean> {
    const job = await knex(JobsTableName)
        .where({ id: jobId })
        .select("state")
        .first()

    return job?.state === "running"
}

export async function updateExplorerRefreshStatus(
    knex: KnexReadWriteTransaction,
    slug: string,
    status: "clean" | "queued" | "refreshing" | "failed",
    lastRefreshAt?: Date
): Promise<void> {
    if (lastRefreshAt) {
        await knexRaw(
            knex,
            `-- sql
                UPDATE explorers
                SET viewsRefreshStatus = ?, lastViewsRefreshAt = ?
                WHERE slug = ?
            `,
            [status, lastRefreshAt, slug]
        )
    } else {
        await knexRaw(
            knex,
            `-- sql
                UPDATE explorers
                SET viewsRefreshStatus = ?
                WHERE slug = ?
            `,
            [status, slug]
        )
    }
}
