import { JsonString } from "../domainTypes/Various.js"
import { OwidGdocContent } from "../gdocTypes/Gdoc.js"

export const PostsGdocsDraftsTableName = "posts_gdocs_drafts"

export interface DbInsertPostGdocDraft {
    gdocId: string
    content: JsonString
    revisionId: number
    updatedBy?: number | null
}

export type DbRawPostGdocDraft = Required<DbInsertPostGdocDraft> & {
    updatedAt: Date
}

export type DbEnrichedPostGdocDraft = Omit<DbRawPostGdocDraft, "content"> & {
    content: OwidGdocContent
}

export function parsePostGdocDraftRow(
    row: DbRawPostGdocDraft
): DbEnrichedPostGdocDraft {
    return { ...row, content: JSON.parse(row.content) }
}
