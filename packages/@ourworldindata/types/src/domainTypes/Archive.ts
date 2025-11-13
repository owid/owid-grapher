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

export type ArchiveContentType = "data" | "writing"

export interface ArchiveSiteNavigationInfo {
    contentType: ArchiveContentType
    liveUrl?: string
    previousVersion?: UrlAndMaybeDate
    nextVersion?: UrlAndMaybeDate
    versionsFileUrl?: string
}

// Information about an archived page version that is available, i.e. we can point to from the live site
export interface ArchivedPageVersion {
    archivalDate: ArchivalDateString
    archiveUrl: string
    versionsFileUrl?: string
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

export interface PostChecksums {
    postContentMd5: string
    indicators: IndicatorChecksums // Shared across all chart types
    graphers: {
        [chartId: string]: {
            slug: string
            chartConfigMd5: string
        }
    }
    explorers: {
        [slug: string]: {
            explorerConfigMd5: string
            chartConfigs: {
                [id: string]: string // chartConfigId -> MD5
            }
        }
    }
    multiDims: {
        [multiDimId: string]: {
            slug: string
            multiDimConfigMd5: string
            chartConfigs: {
                [id: string]: string // chartConfigId -> MD5
            }
        }
    }
    narrativeCharts: {
        [narrativeChartId: string]: {
            name: string
            chartConfigMd5: string
            queryParamsForParentChartMd5: string
        }
    }
    images: {
        [imageId: string]: { filename: string; hash: string }
    }
}

export interface PostChecksumsObjectWithHash {
    postId: string
    postSlug: string
    checksums: PostChecksums
    checksumsHashed: string
}
