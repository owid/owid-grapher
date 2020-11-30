import { TooltipProps } from "grapher/tooltip/TooltipProps"
import { Bounds } from "clientUtils/Bounds"

export interface FooterManager {
    fontSize?: number
    sourcesLine?: string
    note?: string
    hasOWIDLogo?: boolean
    shouldLinkToOwid?: boolean
    originUrlWithProtocol?: string
    isMediaCard?: boolean
    currentTab?: string
    tooltip?: TooltipProps
    tabBounds?: Bounds
}
