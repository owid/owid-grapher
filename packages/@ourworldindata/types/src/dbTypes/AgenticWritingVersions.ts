export const AgenticWritingVersionsTableName = "agentic_writing_versions"

export type AgenticWritingVersionKind = "initial" | "decision" | "revision"
export type AgenticWritingDecision =
    | "approved"
    | "rejected"
    | "request_revisions"

export interface DbInsertAgenticWritingVersion {
    id?: number
    lineageId: number
    versionId: string
    parentVersionId?: string | null
    createdAt?: Date
    createdByUserId?: number | null
    createdByLabel: string
    kind: AgenticWritingVersionKind
    title: string
    description: string
    // JSON columns; in JS the parsed object/array. `payload` holds the
    // content-type-specific shape (e.g. for data_nugget: { grapherViews }).
    payload: unknown
    metadata: unknown
    reviewDecision?: AgenticWritingDecision | null
    reviewComment?: string | null
    reviewedAt?: Date | null
    reviewedByUserId?: number | null
    reviewedByLabel?: string | null
}

export type DbPlainAgenticWritingVersion =
    Required<DbInsertAgenticWritingVersion>
