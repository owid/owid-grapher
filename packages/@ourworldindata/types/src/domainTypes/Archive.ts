export type ArchiveDateString = `${number}-${number}`
export const ARCHIVE_DATE_TIME_FORMAT = "YYYYMMDD-HHmmss" // e.g. 20250414-074331, always UTC

export type AssetMap = Record<string, string>

export interface UrlAndMaybeDate {
    url: string
    date?: Date | ArchiveDateString
}

export interface ArchiveSiteNavigationInfo {
    liveUrl?: string
    previousVersion?: UrlAndMaybeDate
    nextVersion?: UrlAndMaybeDate
}

export interface ArchiveMetaInformation {
    archiveDate: Date | ArchiveDateString
    archiveNavigation: ArchiveSiteNavigationInfo
    archiveUrl: string
    assets?: {
        runtime?: AssetMap
        static?: AssetMap
    }
}
