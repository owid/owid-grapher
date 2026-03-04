import { JsonString } from "../domainTypes/Various.js"

export const ArchivedPostVersionsTableName = "archived_post_versions"

export interface DbInsertArchivedPostVersion {
    archivalTimestamp: Date
    postId: string
    postSlug: string
    hashOfInputs: string
    manifest: JsonString
}

export interface DbPlainArchivedPostVersion extends Required<DbInsertArchivedPostVersion> {
    id: number
}

export interface DbEnrichedArchivedPostVersion extends Omit<
    DbPlainArchivedPostVersion,
    "manifest"
> {
    manifest: Record<string, any> // TODO: Turn into more specific type
}
