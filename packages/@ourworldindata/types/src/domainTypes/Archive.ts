export type ArchivalDateString = `${number}-${number}`
export const ARCHIVE_DATE_TIME_FORMAT = "YYYYMMDD-HHmmss" // e.g. 20250414-074331, always UTC

export type AssetMap = Record<string, string>

export type IndicatorChecksums = {
    [id: string]: { metadataChecksum: string; dataChecksum: string }
}

export interface UrlAndMaybeDate {
    url: string
    date?: Date | ArchivalDateString
}

export interface ArchiveSiteNavigationInfo {
    liveUrl?: string
    previousVersion?: UrlAndMaybeDate
    nextVersion?: UrlAndMaybeDate
    versionsFileUrl?: string
}

// Information about an archived page version that is available, i.e. we can point to from the live site
export interface ArchivedPageVersion {
    archivalDate: ArchivalDateString
    archiveUrl: string
    type: "archived-page-version"
}

// Information about an archived chart that is necessary for rendering the archived page, incl. navigation and assets
export interface ArchiveMetaInformation
    extends Omit<ArchivedPageVersion, "type"> {
    archiveNavigation: ArchiveSiteNavigationInfo
    assets: {
        runtime: AssetMap
        static?: AssetMap
    }
    type: "archive-page"
}

export type ArchiveContext = ArchivedPageVersion | ArchiveMetaInformation

export interface ArchiveVersions {
    chartId: number
    versions: Array<{
        archivalDate: ArchivalDateString
        slug: string
        url: string
    }>
}

export interface GrapherChecksums {
    chartConfigMd5: string
    indicators: IndicatorChecksums
}

export interface GrapherChecksumsObjectWithHash {
    chartId: number
    chartSlug: string
    checksums: GrapherChecksums
    checksumsHashed: string
}

export interface MultiDimChecksums {
    multiDimConfigMd5: string
    chartConfigs: {
        [id: string]: string // chartConfigId -> MD5
    }
    indicators: IndicatorChecksums
}

export interface MultiDimChecksumsObjectWithHash {
    multiDimId: number
    multiDimSlug: string
    checksums: MultiDimChecksums
    checksumsHashed: string
}

export interface ExplorerChecksums {
    explorerConfigMd5: string
    chartConfigs: {
        [id: string]: string // chartId -> chart_configs.fullMd5 of explorer view configs
    }
    indicators: IndicatorChecksums
}

export interface ExplorerChecksumsObjectWithHash {
    explorerSlug: string
    checksums: ExplorerChecksums
    checksumsHashed: string
}
