export const JobsTableName = "jobs"

export type JobState = "queued" | "running" | "done" | "failed"
export type JobType = "refresh_explorer_views" | "comment_agent_request"

export interface ExplorerRefreshJobPayload {
    slug: string
    explorerUpdatedAt: Date
}

/**
 * Someone asked the agent to act on a comment. Only the comment's id travels in
 * the payload: everything the agent needs - what was asked, which chart or
 * multi-dim view, which metadata field - is already recorded on the comment, and
 * reading it when the job runs means the job can't go stale against an edit.
 */
export interface CommentAgentJobPayload {
    commentId: number
}

export type JobPayload = ExplorerRefreshJobPayload | CommentAgentJobPayload

export interface DbInsertJob<P extends JobPayload = JobPayload> {
    type: JobType
    payload: P
}

export type DbRawJob<P extends JobPayload = JobPayload> = DbInsertJob<P> & {
    id: number
    state: JobState
    attempts: number
    lastError: string | null
    createdAt: Date
    updatedAt: Date
}

export type DbPlainJob<P extends JobPayload = JobPayload> = DbRawJob<P>
