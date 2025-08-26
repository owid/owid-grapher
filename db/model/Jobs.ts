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
    await knexRaw(
        knex,
        `-- sql
            INSERT INTO jobs (type, slug, state, attempts, explorerUpdatedAt)
            VALUES (?, ?, 'queued', 0, ?)
            ON DUPLICATE KEY UPDATE
                state = 'queued',
                explorerUpdatedAt = VALUES(explorerUpdatedAt),
                lastError = NULL,
                attempts = 0
        `,
        [job.type, job.slug, job.explorerUpdatedAt]
    )
}

export async function claimNextQueuedJob(
    knex: KnexReadWriteTransaction,
    type: JobType,
    _options: JobClaimOptions
): Promise<DbPlainJob | null> {
    // Atomically claim the next queued job by updating its state
    const result = await knexRaw(
        knex,
        `-- sql
            UPDATE jobs
            SET state = 'running'
            WHERE id = (
                SELECT id FROM (
                    SELECT id FROM jobs
                    WHERE type = ? AND state = 'queued'
                    ORDER BY id ASC
                    LIMIT 1
                ) AS subquery
            )
        `,
        [type]
    )

    // TODO: switch to knexRawInsert and investigate if mysql 8 and knex
    // will have affectedRows - if so, add that to the signature of knexRawInsert
    if ((result[0] as any).affectedRows === 0) {
        return null
    }

    // Fetch the claimed job
    const claimedJob = await knex(JobsTableName)
        .where({ type, state: "running" })
        .orderBy("id", "asc")
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
