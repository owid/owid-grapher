export const AgenticWritingLineagesTableName = "agentic_writing_lineages"

// One row per drafted "piece" in the agentic-writing playground. The first
// content type is the data-nugget — others can be added by extending the enum.
export type AgenticWritingContentType = "data_nugget"

export interface DbInsertAgenticWritingLineage {
    id?: number
    lineageKey: string
    contentType?: AgenticWritingContentType
    sourceId: string
    localId: string
    ownerUserId: number
    submittedAt?: Date | null
    submittedByUserId?: number | null
    publishedAt?: Date | null
    publishedByUserId?: number | null
    createdAt?: Date
    updatedAt?: Date
}

export type DbPlainAgenticWritingLineage =
    Required<DbInsertAgenticWritingLineage>
