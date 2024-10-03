export type DbInsertPostGdocTombstone = {
    gdocId: string
    slug: string
    reason?: string
    includeArchiveLink?: boolean
    relatedLinkUrl?: string
    relatedLinkTitle?: string
    relatedLinkDescription?: string
    relatedLinkThumbnail?: string
}

export type DbPlainPostGdocTombstone = Required<DbInsertPostGdocTombstone> & {
    id: number
    createdAt: Date
    updatedAt: Date
}
