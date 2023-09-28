import { Bounds } from "@ourworldindata/utils"

export interface HeaderManager {
    currentTitle?: string
    currentSubtitle?: string
    hideLogo?: boolean
    shouldLinkToOwid?: boolean
    logo?: string
    canonicalUrl?: string
    tabBounds?: Bounds
    detailsOrderedByReference?: Set<string>
    shouldIncludeDetailsInStaticExport?: boolean
    isExportingtoSvgOrPng?: boolean
    isSmall?: boolean
    isMedium?: boolean
}
