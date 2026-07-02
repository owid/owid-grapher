import { JsonString } from "../domainTypes/Various.js"
import { OwidGdocContent } from "../gdocTypes/Gdoc.js"

export const PostsGdocsRevisionsTableName = "posts_gdocs_revisions"

export type PostGdocRevisionKind = "autosave" | "manual" | "publish" | "restore"

export interface DbInsertPostGdocRevision {
    id?: number
    gdocId: string
    content: JsonString
    kind?: PostGdocRevisionKind
    label?: string | null
    createdBy?: number | null
}

export type DbRawPostGdocRevision = Required<DbInsertPostGdocRevision> & {
    createdAt: Date
}

export type DbEnrichedPostGdocRevision = Omit<
    DbRawPostGdocRevision,
    "content"
> & {
    content: OwidGdocContent
}

export function parsePostGdocRevisionRow(
    row: DbRawPostGdocRevision
): DbEnrichedPostGdocRevision {
    return { ...row, content: JSON.parse(row.content) }
}
