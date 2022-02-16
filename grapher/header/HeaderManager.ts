import { Bounds } from "../../clientUtils/Bounds.js"

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
}
