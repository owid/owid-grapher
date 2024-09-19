export type DbInsertPostGdocTombstone = {
    gdocId: string
    slug: string
    reason?: string
    relatedLink?: string
}

export type DbPlainPostGdocTombstone = Required<DbInsertPostGdocTombstone> & {
    id: number
    createdAt: Date
    updatedAt: Date
}
