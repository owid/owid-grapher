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
    isNarrow?: boolean
    isSmall?: boolean
    isMedium?: boolean
    framePaddingHorizontal?: number
    framePaddingVertical?: number
    isOnCanonicalUrl?: boolean
    isInIFrame?: boolean
}
