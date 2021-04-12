import { TooltipProps } from "../tooltip/TooltipProps"
import { Bounds } from "../../clientUtils/Bounds"

export interface FooterManager {
    readonly fontSize?: number
    readonly sourcesLine?: string
    readonly note?: string
    readonly hasOWIDLogo?: boolean
    readonly shouldLinkToOwid?: boolean
    readonly originUrlWithProtocol?: string
    readonly isMediaCard?: boolean
    readonly tooltip?: TooltipProps
    readonly tabBounds?: Bounds
    currentTab?: string
}
