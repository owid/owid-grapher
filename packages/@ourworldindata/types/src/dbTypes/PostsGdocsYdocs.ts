export const PostsGdocsYdocsTableName = "posts_gdocs_ydocs"

/**
 * Live-collaboration state for a natively-edited gdoc: the Yjs document blob
 * the sync server loads and stores. Disposable by design — the draft JSON is
 * the durable format; deleting a row just forces a reseed on next open.
 */
export interface DbInsertPostGdocYdoc {
    gdocId: string
    /** Y.encodeStateAsUpdate output (already history-compacted) */
    ydoc: Uint8Array
    /** The PM schema generation this blob was created under */
    schemaVersion: number
    /** Random id per seed; clients holding a stale generation must reload */
    generation: string
    /** The draft revision the ydoc was seeded from, for debugging */
    seededFromRevisionId?: number | null
}

export type DbRawPostGdocYdoc = Required<DbInsertPostGdocYdoc> & {
    updatedAt: Date
}
