export const JobsTableName = "jobs"

export type JobState = "queued" | "running" | "done" | "failed"
export type JobType = "refresh_explorer_views"

export interface DbInsertJob {
    type: JobType
    slug: string
    explorerUpdatedAt: Date
}

export type DbRawJob = DbInsertJob & {
    id: number
    state: JobState
    attempts: number
    priority: number
    lastError: string | null
    lockedAt: Date | null
    lockedBy: string | null
    createdAt: Date
    updatedAt: Date
}

export type DbPlainJob = DbRawJob
