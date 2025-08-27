export const JobsTableName = "jobs"

export type JobState = "queued" | "running" | "done" | "failed"
export type JobType = "refresh_explorer_views"

export interface ExplorerRefreshJobPayload {
    slug: string
    explorerUpdatedAt: Date
}

export interface DbInsertJob {
    type: JobType
    payload: ExplorerRefreshJobPayload
}

export type DbRawJob = DbInsertJob & {
    id: number
    state: JobState
    attempts: number
    lastError: string | null
    createdAt: Date
    updatedAt: Date
}

export type DbPlainJob = DbRawJob
