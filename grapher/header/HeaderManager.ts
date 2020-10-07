import { Bounds } from "grapher/utils/Bounds"

export interface HeaderManager {
    fontSize?: number
    currentTitle?: string
    subtitle?: string
    hideLogo?: boolean
    isNativeEmbed?: boolean
    isMediaCard?: boolean
    logo?: string
    canonicalUrl?: string
    tabBounds?: Bounds
}
