export interface UrlAndMaybeDate {
    url: string
    date?: Date
}
export interface ArchiveSiteNavigationProps {
    archiveDate: Date
    liveUrl?: string
    previousVersion?: UrlAndMaybeDate
    nextVersion?: UrlAndMaybeDate
}

export type ArchiveMetaInformation = ArchiveSiteNavigationProps
