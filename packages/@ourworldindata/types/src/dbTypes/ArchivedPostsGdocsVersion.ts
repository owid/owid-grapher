import { JsonString } from "../domainTypes/Various.js"

export const ArchivedPostsGdocsVersionsTableName =
    "archived_posts_gdocs_versions"

export interface DbInsertArchivedPostsGdocsVersion {
    archivalTimestamp: Date
    postId: string
    postSlug: string
    hashOfInputs: string
    manifest: JsonString
}

export interface DbPlainArchivedPostsGdocsVersion
    extends Required<DbInsertArchivedPostsGdocsVersion> {
    id: number
}

export interface DbEnrichedArchivedPostsGdocsVersion
    extends Omit<DbPlainArchivedPostsGdocsVersion, "manifest"> {
    manifest: Record<string, any> // TODO: Turn into more specific type
}
