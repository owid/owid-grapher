import { Bounds } from "@ourworldindata/utils"

export interface HeaderManager {
    fontSize?: number
    currentTitle?: string
    subtitle?: string
    hideLogo?: boolean
    shouldLinkToOwid?: boolean
    isMediaCard?: boolean
    logo?: string
    canonicalUrl?: string
    tabBounds?: Bounds
    detailsOrderedByReference?: Set<string>
    shouldIncludeDetailsInStaticExport?: boolean
}
