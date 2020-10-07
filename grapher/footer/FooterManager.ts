import { TooltipProps } from "grapher/tooltip/TooltipProps"
import { Bounds } from "grapher/utils/Bounds"

export interface FooterManager {
    fontSize?: number
    sourcesLine?: string
    note?: string
    hasOWIDLogo?: boolean
    isNativeEmbed?: boolean
    originUrlWithProtocol?: string
    isMediaCard?: boolean
    currentTab?: string
    tooltip?: TooltipProps
    tabBounds?: Bounds
}
