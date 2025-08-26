export const JobsTableName = "jobs"

export type JobState = "queued" | "running" | "done" | "failed"
export type JobType = "refresh_explorer_views"

export interface DbInsertJob {
    type: JobType
    slug: string
    state?: JobState
    attempts?: number
    priority?: number
    explorerUpdatedAt: Date
    lastError?: string | null
    lockedAt?: Date | null
    lockedBy?: string | null
}

export type DbRawJob = Required<DbInsertJob> & {
    id: number
    createdAt: Date
    updatedAt: Date
}

export type DbPlainJob = DbRawJob
