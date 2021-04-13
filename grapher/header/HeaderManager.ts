import { Bounds } from "../../clientUtils/Bounds"

export interface HeaderManager {
    readonly fontSize?: number
    readonly currentTitle?: string
    readonly subtitle?: string
    readonly hideLogo?: boolean
    readonly shouldLinkToOwid?: boolean
    readonly isMediaCard?: boolean
    readonly logo?: string
    readonly canonicalUrl?: string
    readonly tabBounds?: Bounds
}
