import { KnexReadWriteTransaction } from "../db.js"
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
    await knex(JobsTableName)
        .insert({
            ...job,
            state: job.state ?? "queued",
            attempts: job.attempts ?? 0,
            priority: job.priority ?? 0,
            createdAt: new Date(),
            updatedAt: new Date(),
        })
        .onConflict(["type", "slug"])
        .merge({
            state: "queued",
            explorerUpdatedAt: job.explorerUpdatedAt,
            updatedAt: new Date(),
            lastError: null,
            attempts: 0,
            lockedAt: null,
            lockedBy: null,
        })
}

export async function claimNextQueuedJob(
    knex: KnexReadWriteTransaction,
    type: JobType,
    options: JobClaimOptions
): Promise<DbPlainJob | null> {
    // Use a transaction to atomically claim a job
    const result = await knex.raw(
        `
        UPDATE jobs 
        SET state = 'running', 
            lockedAt = NOW(), 
            lockedBy = ?
        WHERE id = (
            SELECT id FROM (
                SELECT id FROM jobs 
                WHERE type = ? AND state = 'queued' 
                ORDER BY priority DESC, id ASC 
                LIMIT 1
            ) AS subquery
        )
    `,
        [options.lockId, type]
    )

    if (result[0].affectedRows === 0) {
        return null
    }

    // Fetch the claimed job
    const claimedJob = await knex(JobsTableName)
        .where({ type, state: "running", lockedBy: options.lockId })
        .first()

    return claimedJob || null
}

export async function markJobDone(
    knex: KnexReadWriteTransaction,
    jobId: number,
    message?: string
): Promise<void> {
    await knex(JobsTableName)
        .where({ id: jobId })
        .update({
            state: "done",
            lastError: message || null,
            updatedAt: new Date(),
        })
}

export async function markJobFailed(
    knex: KnexReadWriteTransaction,
    jobId: number,
    error: Error | string
): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : error

    await knex(JobsTableName)
        .where({ id: jobId })
        .update({
            state: "failed",
            lastError: errorMessage.slice(0, 1000), // Limit error message length
            updatedAt: new Date(),
        })
}

export async function requeueJob(
    knex: KnexReadWriteTransaction,
    jobId: number,
    attempts: number
): Promise<void> {
    await knex(JobsTableName).where({ id: jobId }).update({
        state: "queued",
        attempts: attempts,
        lockedAt: null,
        lockedBy: null,
        updatedAt: new Date(),
    })
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
    const updateData: any = {
        viewsRefreshStatus: status,
        updatedAt: new Date(),
    }

    if (lastRefreshAt) {
        updateData.lastViewsRefreshAt = lastRefreshAt
    }

    await knex("explorers").where({ slug }).update(updateData)
}
