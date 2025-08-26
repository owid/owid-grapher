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
    // Mark any existing queued jobs for this slug as done (superseded)
    await knexRaw(
        knex,
        `-- sql
            UPDATE jobs
            SET state = 'done', lastError = 'superseded by newer update'
            WHERE type = ? AND slug = ? AND state = 'queued'
        `,
        [job.type, job.slug]
    )

    // Insert the new job
    await knexRaw(
        knex,
        `-- sql
            INSERT INTO jobs (type, slug, state, attempts, explorerUpdatedAt)
            VALUES (?, ?, 'queued', 0, ?)
        `,
        [job.type, job.slug, job.explorerUpdatedAt]
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

    return claimedJob || null
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
    return await knex(JobsTableName).where({ type, slug }).first()
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
