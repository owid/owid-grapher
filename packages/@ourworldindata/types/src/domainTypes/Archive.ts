export type ArchivalDateString = `${number}-${number}`
export const ARCHIVE_DATE_TIME_FORMAT = "YYYYMMDD-HHmmss" // e.g. 20250414-074331, always UTC

export type AssetMap = Record<string, string>

export interface UrlAndMaybeDate {
    url: string
    date?: Date | ArchivalDateString
}

export interface ArchiveSiteNavigationInfo {
    liveUrl?: string
    previousVersion?: UrlAndMaybeDate
    nextVersion?: UrlAndMaybeDate
}

// Information about an archived chart version that is available, i.e. we can point to from the live site
export interface ChartArchivedVersion {
    archivalDate: ArchivalDateString
    archiveUrl: string
    type: "archived-chart-version"
}

// Information about an archived chart that is necessary for rendering the archived page, incl. navigation and assets
export interface ArchiveMetaInformation
    extends Omit<ChartArchivedVersion, "type"> {
    archiveNavigation: ArchiveSiteNavigationInfo
    assets: {
        runtime: AssetMap
        static?: AssetMap
    }
    type: "archive-chart"
}

export type ArchivedChartOrArchiveChartMeta =
    | ChartArchivedVersion
    | ArchiveMetaInformation
