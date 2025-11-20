export type CreateTombstoneData = {
    reason?: string
    includeArchiveLink?: boolean
    relatedLinkUrl?: string
    relatedLinkTitle?: string
    relatedLinkDescription?: string
    relatedLinkThumbnail?: string
}

export type TombstonePageData = {
    slug: string
    reason: string
    includeArchiveLink: boolean
    relatedLinkUrl: string
    relatedLinkTitle: string
    relatedLinkDescription: string
    relatedLinkThumbnail: string
    archiveUrl?: string
}
