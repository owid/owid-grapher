import { Bounds } from "@ourworldindata/utils"
import { SizeVariant } from "../core/GrapherConstants"

export interface HeaderManager {
    fontSize?: number
    currentTitle?: string
    subtitle?: string
    hideLogo?: boolean
    shouldLinkToOwid?: boolean
    logo?: string
    canonicalUrl?: string
    tabBounds?: Bounds
    detailsOrderedByReference?: Set<string>
    shouldIncludeDetailsInStaticExport?: boolean
    isExportingtoSvgOrPng?: boolean
    sizeVariant?: SizeVariant
}
